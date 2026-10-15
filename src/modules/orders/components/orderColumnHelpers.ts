export const formatStatusLabel = (status: string): string => {
  switch (status) {
    case 'form_sent': return 'Form sent';
    case 'customer_completed': return 'Customer done';
    case 'Not_Received': return 'Not received';
    case 'In_Progress': return 'In progress';
    case 'In Stock': return 'In stock';
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
};
