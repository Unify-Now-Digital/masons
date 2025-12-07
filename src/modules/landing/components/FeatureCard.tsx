
import React from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  image?: React.ReactNode;
  imageAlt?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ 
  title, 
  description, 
  icon,
  image,
  imageAlt
}) => {
  return (
    <Card className="feature-gradient border-none shadow-md h-full flex flex-col">
      <CardContent className="pt-6 h-full flex flex-col">
        <div className="rounded-full bg-blue-100 p-2.5 w-10 h-10 flex items-center justify-center text-blue-700 mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-slate-600 mb-6">{description}</p>
        {image && (
          <div className="mt-auto rounded-md overflow-hidden border border-slate-200 shadow-sm">
            {image}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
