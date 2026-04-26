import React from 'react';
import { Link } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { FeatureCard } from '../components/FeatureCard';
import { TestimonialCard } from '../components/TestimonialCard';
import { Button } from "@/shared/components/ui/button";
import { Mail, MapPin, CalendarClock, CalendarCheck, Check, Star } from 'lucide-react';
import { 
  AutomatedCommunicationImage, 
  MapViewImage, 
  OrderProgressImage, 
  OverdueOrdersImage 
} from '../components/FeatureScreenshots';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-28 pb-16 md:pt-32 md:pb-24 marble-bg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gardens-tx mb-6 leading-tight">
              Modern Memorial Management Software for Mason Professionals
            </h1>
            <p className="text-lg md:text-xl text-gardens-tx mb-8 mx-auto max-w-2xl">
              Streamline your memorial masonry business with our modern platform. 
              From first payment to installation, manage every step with ease and precision.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button size="lg" className="text-base" asChild>
                <Link to="/register">Start Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base" asChild>
                <Link to="/register">Book a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-gardens-tx mb-4">
              Designed Specifically for Memorial Masons
            </h2>
            <p className="text-lg text-gardens-tx max-w-2xl mx-auto">
              Our platform helps you manage every aspect of your memorial stone business with 
              features tailored to your unique needs.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FeatureCard 
              title="Automated First Contact & Communications"
              description="Respond instantly to new customer inquiries and keep clients informed with automated email sequences and appointment reminders."
              icon={<Mail />}
              image={<AutomatedCommunicationImage />}
            />
            
            <FeatureCard 
              title="Interactive Map View of Jobs"
              description="Visualize all your active and completed jobs on an interactive map. Plan efficient routes and manage your workforce more effectively."
              icon={<MapPin />}
              image={<MapViewImage />}
            />
            
            <FeatureCard 
              title="Order Progress Tracking"
              description="Monitor each order from initial consultation to installation with our intuitive progress tracking system. Never miss a deadline again."
              icon={<CalendarClock />}
              image={<OrderProgressImage />}
            />
            
            <FeatureCard 
              title="Highlight Orders Needing Attention"
              description="Get instant alerts for orders that are overdue, need approval, or require urgent attention. Resolve issues before they become problems."
              icon={<CalendarCheck />}
              image={<OverdueOrdersImage />}
            />
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 md:py-24 bg-gardens-page">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-gardens-tx mb-4">
              Trusted by Memorial Professionals
            </h2>
            <p className="text-lg text-gardens-tx max-w-2xl mx-auto">
              Here's what our customers have to say about Unify Digital.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="Unify Digital has revolutionized how we manage our memorial business. The automated communication system alone has saved us countless hours."
              author="Robert Wilson"
              role="Owner"
              companyName="Wilson Memorial Arts"
            />
            
            <TestimonialCard 
              quote="The map view feature helps us optimize our installation schedule. We can now complete more jobs in less time with better planning."
              author="Sarah Johnson"
              role="Operations Manager"
              companyName="Heritage Memorials"
            />
            
            <TestimonialCard 
              quote="Being able to instantly see which orders need attention has dramatically improved our customer satisfaction. Issues are resolved before clients even notice them."
              author="Michael Thomas"
              role="Director"
              companyName="Eternal Stone Creations"
            />
          </div>
        </div>
      </section>
      
      {/* Pricing Section - Hidden for now but kept for future use */}
      {/*
      <section id="pricing" className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-gardens-tx mb-4">
              Volume-Based Pricing for Growing Businesses
            </h2>
            <p className="text-lg text-gardens-tx max-w-2xl mx-auto">
              Choose the plan that fits your business needs. Pricing based on open jobs per month with flexible scaling options.
            </p>
            <div className="mt-6 text-sm text-gardens-txs">
              All plans include a 14-day free trial. No credit card required. Annual plans save ~16%.
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              
              <div className="border border-gardens-bdr rounded-lg p-6 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-gardens-tx mb-2">Free</h3>
                <p className="text-gardens-tx mb-4 text-sm">Perfect for getting started</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gardens-tx">€0</span>
                  <span className="text-gardens-tx text-sm">/month</span>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-medium text-gardens-tx mb-2">Up to 5 open jobs/month</div>
                  <div className="text-sm text-gardens-txs mb-4">1 user included</div>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Basic job posting</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Applicant tracking</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Email support</span>
                  </li>
                </ul>
                
                <Button variant="outline" className="w-full text-sm">Start Free</Button>
              </div>
              
              <div className="border border-gardens-bdr rounded-lg p-6 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-gardens-tx mb-2">Starter</h3>
                <p className="text-gardens-tx mb-4 text-sm">For small to medium businesses</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gardens-tx">€93</span>
                  <span className="text-gardens-tx text-sm">/month</span>
                  <div className="text-xs text-gardens-grn-dk mt-1">€931/year (16% off)</div>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-medium text-gardens-tx mb-2">Up to 20 open jobs/month</div>
                  <div className="text-sm text-gardens-txs mb-2">Up to 3 users included</div>
                  <div className="text-xs text-gardens-txs">€5.70 per additional job</div>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">All Free features</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Advanced filtering</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Team collaboration</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Priority email support</span>
                  </li>
                </ul>
                
                <Button variant="outline" className="w-full text-sm">Start Free Trial</Button>
              </div>
              
              <div className="border-2 border-gardens-blu rounded-lg p-6 bg-white shadow-lg relative">
                <div className="absolute top-0 right-0 bg-gardens-blu text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg flex items-center">
                  <Star className="h-3 w-3 mr-1" />
                  POPULAR
                </div>
                <h3 className="text-lg font-bold text-gardens-tx mb-2">Professional</h3>
                <p className="text-gardens-tx mb-4 text-sm">For medium to large businesses</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gardens-tx">€283</span>
                  <span className="text-gardens-tx text-sm">/month</span>
                  <div className="text-xs text-gardens-grn-dk mt-1">€2,830/year (16% off)</div>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-medium text-gardens-tx mb-2">Up to 50 open jobs/month</div>
                  <div className="text-sm text-gardens-txs mb-2">Up to 10 users included</div>
                  <div className="text-xs text-gardens-txs">€4.75 per additional job</div>
                  <div className="text-xs text-gardens-txs">€19/month per extra user (max 20)</div>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">All Starter features</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Custom job branding</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Analytics dashboard</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">24/7 chat support</span>
                  </li>
                </ul>
                
                <Button className="w-full text-sm">Start Free Trial</Button>
              </div>
              
              <div className="border border-gardens-bdr rounded-lg p-6 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-gardens-tx mb-2">Enterprise</h3>
                <p className="text-gardens-tx mb-4 text-sm">For large enterprises</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gardens-tx">€947</span>
                  <span className="text-gardens-tx text-sm">/month</span>
                  <div className="text-xs text-gardens-grn-dk mt-1">€9,470/year (16% off)</div>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-medium text-gardens-tx mb-2">Up to 200 open jobs/month</div>
                  <div className="text-sm text-gardens-txs mb-2">Up to 25 users included</div>
                  <div className="text-xs text-gardens-txs">€3.80 per additional job</div>
                  <div className="text-xs text-gardens-txs">€15.20/month per extra user (max 50)</div>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">All Professional features</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">API access</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Dedicated account manager</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Advanced security</span>
                  </li>
                </ul>
                
                <Button variant="outline" className="w-full text-sm">Start Free Trial</Button>
              </div>
              
              <div className="border border-gardens-bdr rounded-lg p-6 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                <h3 className="text-lg font-bold text-gardens-tx mb-2">Custom</h3>
                <p className="text-gardens-tx mb-4 text-sm">For complex enterprise needs</p>
                <div className="mb-6">
                  <span className="text-2xl font-bold text-gardens-tx">Custom</span>
                  <span className="text-gardens-tx text-sm block">Contact sales</span>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm font-medium text-gardens-tx mb-2">200+ open jobs/month</div>
                  <div className="text-sm text-gardens-txs mb-2">Custom user limits</div>
                  <div className="text-xs text-gardens-txs">Custom rates & terms</div>
                </div>
                
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">All Enterprise features</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Custom integrations</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Service Level Agreements</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-gardens-grn mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gardens-tx">Tailored onboarding</span>
                  </li>
                </ul>
                
                <Button variant="outline" className="w-full text-sm">Contact Sales</Button>
              </div>
              
            </div>
            
            <div className="mt-12 text-center">
              <p className="text-sm text-gardens-txs mb-4">
                All plans include overage protection and can scale with your business needs.
              </p>
              <div className="bg-gardens-blu-lt border border-gardens-blu-lt rounded-lg p-4 max-w-2xl mx-auto">
                <p className="text-sm text-gardens-blu-dk font-medium mb-2">
                  💡 Recommended: Try Professional Tier Free for 14 Days
                </p>
                <p className="text-xs text-gardens-blu-dk">
                  Most businesses find the Professional tier perfect for their needs. Start your free trial today!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}
      
      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gardens-blu-dk text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Ready to Transform Your Memorial Business?
            </h2>
            <p className="text-lg mb-8 text-gardens-blu-lt">
              Join hundreds of memorial professionals who are saving time and improving customer satisfaction with Unify Digital.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button size="lg" variant="secondary" className="text-base text-gardens-blu-dk" asChild>
                <Link to="/register">Start Your Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-base" asChild>
                <Link to="/register">Schedule a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-gardens-sidebar text-gardens-txs">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white text-lg font-semibold mb-4">Unify Digital</h3>
              <p className="text-sm mb-4">Modern software for memorial professionals.</p>
              <p className="text-sm">&copy; 2025 Unify Digital Inc.</p>
            </div>
            
            <div>
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Testimonials</a></li>
                <li><a href="#" className="hover:text-white">Case Studies</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
                <li><a href="#" className="hover:text-white">Training</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
