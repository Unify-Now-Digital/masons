import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Loader2, Image } from 'lucide-react';
import { proofGenerateFormSchema, type ProofGenerateFormData } from '../schemas/proof.schema';
import { useGenerateProof } from '../hooks/useProofs';
import type { OrderProof } from '../types/proofs.types';
import { INSCRIPTION_FONT_OPTIONS } from '@/modules/orders';

interface ProofGenerateFormProps {
  orderId: string;
  initialInscriptionText?: string | null;
  initialStonePhotoUrl?: string | null;
  /** Pre-populate font style from the order's inscription_font field */
  initialFontStyle?: string | null;
  /** If provided with isChangesRequested, pre-populate additional_instructions */
  changesNote?: string | null;
  isChangesRequested?: boolean;
  onSuccess?: (proof: OrderProof) => void;
}

export const ProofGenerateForm: React.FC<ProofGenerateFormProps> = ({
  orderId,
  initialInscriptionText,
  initialStonePhotoUrl,
  initialFontStyle,
  changesNote,
  isChangesRequested,
  onSuccess,
}) => {
  const generateMutation = useGenerateProof();

  const form = useForm<ProofGenerateFormData>({
    resolver: zodResolver(proofGenerateFormSchema),
    defaultValues: {
      inscription_text: initialInscriptionText ?? '',
      stone_photo_url: initialStonePhotoUrl ?? '',
      font_style: initialFontStyle ?? null,
      additional_instructions: isChangesRequested && changesNote ? changesNote : '',
    },
  });

  const onSubmit = (values: ProofGenerateFormData) => {
    generateMutation.mutate(
      {
        order_id: orderId,
        inscription_text: values.inscription_text,
        stone_photo_url: values.stone_photo_url || null,
        font_style: values.font_style ?? null,
        additional_instructions: values.additional_instructions ?? null,
      },
      {
        onSuccess: (data) => {
          // onSuccess receives ProofGenerateResponse; parent can refetch the full proof
          // We pass the response cast to satisfy the callback — parent typically re-reads from cache
          onSuccess?.(data as unknown as OrderProof);
        },
      },
    );
  };

  const photoUrl = form.watch('stone_photo_url');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {isChangesRequested && changesNote && (
          <div className="rounded-md bg-gardens-amb-lt border border-gardens-amb-lt px-3 py-2 text-sm text-gardens-amb-dk">
            <span className="font-medium">Requested changes: </span>{changesNote}
          </div>
        )}

        <FormField
          control={form.control}
          name="inscription_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inscription text <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter the full inscription as it should appear on the stone…"
                  rows={4}
                  disabled={generateMutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stone_photo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stone photo URL</FormLabel>
              {photoUrl && (
                <div className="mb-2">
                  <img
                    src={photoUrl}
                    alt="Stone preview"
                    className="h-24 w-24 object-cover rounded border"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
              {!photoUrl && (
                <div className="flex items-center justify-center h-16 w-24 rounded border border-dashed text-muted-foreground mb-2">
                  <Image className="h-6 w-6" />
                </div>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ''}
                  placeholder="https://…/stone-photo.jpg (leave blank to generate without)"
                  disabled={generateMutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="font_style"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Font style</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                value={field.value ?? 'none'}
                disabled={generateMutation.isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a font style (optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  {INSCRIPTION_FONT_OPTIONS.map((font) => (
                    <SelectItem key={font} value={font}>{font}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="additional_instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional instructions</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  placeholder="Any other details for the engraver or designer…"
                  rows={2}
                  disabled={generateMutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {generateMutation.isError && (
          <p className="text-sm text-destructive">
            {generateMutation.error instanceof Error
              ? generateMutation.error.message
              : 'Generation failed. Please try again.'}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : isChangesRequested ? (
            'Regenerate Proof'
          ) : (
            'Generate Proof'
          )}
        </Button>
      </form>
    </Form>
  );
};
