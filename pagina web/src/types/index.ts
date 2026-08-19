export interface Service {
  id: string;
  number: string;
  name: string;
  description: string;
}

export interface Testimonial {
  id: string;
  name: string;
  quote: string;
  source: string;
  isPlaceholder: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  instagramUrl: string;
  hours: string;
  whatsappUrl: string;
}
