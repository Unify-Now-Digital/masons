import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const allowedOrigin = Deno.env.get("APP_ORIGIN") || "http://localhost:8080";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};

interface GeocodeRequest {
  orderId: string;
  location: string;
}

interface GeocodeResponse {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight (no auth required)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse request body
    const { orderId, location }: GeocodeRequest = await req.json();

    // Validate input: orderId must be a string
    if (!orderId || typeof orderId !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "orderId is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return new Response(
        JSON.stringify({ ok: false, error: "orderId must be a valid UUID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate location: must be non-empty after trim and reasonable length (>= 6 chars, <= 500 chars)
    const trimmedLocation = location?.trim();
    if (!location || typeof location !== "string" || trimmedLocation.length < 6 || trimmedLocation.length > 500) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "location must be a non-empty string between 6 and 500 characters after trimming" 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Supabase client with user's JWT (preferred over service role key)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Google Maps API key from Supabase secrets
    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!googleApiKey) {
      console.error("GOOGLE_MAPS_API_KEY not found in Supabase secrets");
      
      // Update order with error status
      await supabaseClient
        .from("orders")
        .update({
          geocode_status: "failed",
          geocode_error: "Geocoding service not configured (API key missing)",
        })
        .eq("id", orderId);
      
      return new Response(
        JSON.stringify({ ok: false, error: "Geocoding service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call Google Geocoding API
    const encodedAddress = encodeURIComponent(trimmedLocation);
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleApiKey}`;

    let geocodeResponse: Response;
    try {
      geocodeResponse = await fetch(geocodeUrl);
    } catch (error) {
      console.error("Geocoding API request failed:", error);
      
      // Update order with error status
      await supabaseClient
        .from("orders")
        .update({
          geocode_status: "failed",
          geocode_error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
        .eq("id", orderId);
      
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to reach geocoding service" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const geocodeData = await geocodeResponse.json();

    // Handle Google API errors
    if (geocodeData.status !== "OK") {
      let errorMessage = `Geocoding failed: ${geocodeData.status}`;
      if (geocodeData.error_message) {
        errorMessage += ` - ${geocodeData.error_message}`;
      }

      // Update order with error status (do not overwrite existing latitude/longitude)
      await supabaseClient
        .from("orders")
        .update({
          geocode_status: "failed",
          geocode_error: errorMessage,
          // Note: latitude and longitude are not updated on failure (preserved)
        })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({ ok: false, error: errorMessage }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract coordinates from response
    if (!geocodeData.results || geocodeData.results.length === 0) {
      await supabaseClient
        .from("orders")
        .update({
          geocode_status: "failed",
          geocode_error: "No results found for address",
        })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({ ok: false, error: "No results found for address" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the first (best) result
    const firstResult = geocodeData.results[0];
    const locationData = firstResult.geometry?.location;
    
    if (!locationData || typeof locationData.lat !== "number" || typeof locationData.lng !== "number") {
      await supabaseClient
        .from("orders")
        .update({
          geocode_status: "failed",
          geocode_error: "Invalid coordinates in geocoding response",
        })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({ ok: false, error: "Invalid coordinates in geocoding response" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const latitude = locationData.lat;
    const longitude = locationData.lng;
    const placeId = firstResult.place_id || null;

    // Update order with coordinates and success metadata
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        latitude: latitude,
        longitude: longitude,
        geocode_status: "ok",
        geocoded_at: new Date().toISOString(),
        geocode_place_id: placeId,
        geocode_error: null, // Clear any previous error
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to update order:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to update order with coordinates" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Return success response
    const response: GeocodeResponse = {
      ok: true,
      latitude: latitude,
      longitude: longitude,
      placeId: placeId || undefined,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error in geocode-order-address:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: `Internal server error: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

