export interface HeadstoneType {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
}

export const HEADSTONE_TYPES: HeadstoneType[] = [
  {
    id: 'ogee',
    label: 'Ogee Headstone',
    description: 'Classic curved top design, elegant and timeless',
    imageUrl: '/headstones/ogee-headstone.svg',
  },
  {
    id: 'heart',
    label: 'Heart Headstone',
    description: 'Heart-shaped memorial symbolising enduring love',
    imageUrl: '/headstones/heart-headstone.svg',
  },
  {
    id: 'book',
    label: 'Book Memorial',
    description: 'Open book design representing a life story',
    imageUrl: '/headstones/book-memorial.svg',
  },
  {
    id: 'cross',
    label: 'Celtic Cross',
    description: 'Traditional Celtic cross with interlace detail',
    imageUrl: '/headstones/cross-memorial.svg',
  },
  {
    id: 'full-kerb',
    label: 'Full Kerb Memorial',
    description: 'Complete grave surround with headstone and kerb set',
    imageUrl: '/headstones/full-kerb-memorial.svg',
  },
  {
    id: 'gothic',
    label: 'Gothic Headstone',
    description: 'Pointed arch design with gothic architectural detail',
    imageUrl: '/headstones/gothic-headstone.svg',
  },
  {
    id: 'double',
    label: 'Double Headstone',
    description: 'Double arch memorial for two inscriptions',
    imageUrl: '/headstones/double-headstone.svg',
  },
  {
    id: 'cremation',
    label: 'Cremation Tablet',
    description: 'Elegant flat tablet for cremation plots and gardens',
    imageUrl: '/headstones/cremation-tablet.svg',
  },
  {
    id: 'childrens',
    label: "Children's Memorial",
    description: 'Sensitive designs with angel and teddy bear motifs',
    imageUrl: '/headstones/childrens-memorial.svg',
  },
  {
    id: 'temple',
    label: 'Temple Style',
    description: 'Classical columns with canopy top and optional cross',
    imageUrl: '/headstones/temple-memorial.svg',
  },
  {
    id: 'lawn',
    label: 'Lawn Memorial',
    description: 'Simple flat-top headstone for lawn cemetery sections',
    imageUrl: '/headstones/flat-lawn-memorial.svg',
  },
];

export function getHeadstoneTypeById(id: string): HeadstoneType | undefined {
  return HEADSTONE_TYPES.find((t) => t.id === id);
}

export function getHeadstoneTypeByLabel(label: string): HeadstoneType | undefined {
  return HEADSTONE_TYPES.find((t) => t.label.toLowerCase() === label.toLowerCase());
}
