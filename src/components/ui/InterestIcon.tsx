import {
  Bike, Car, Clapperboard, Coffee, Dices, Feather, Gamepad2, Mountain, Music, ShoppingBag, Spade, Sparkles,
  Ticket, UtensilsCrossed, Waves, type LucideIcon,
} from "lucide-react";

// ST-019.2: placeholder icon set until design supplies the 14 interest icons.
const ICONS: Record<string, LucideIcon> = {
  badminton: Feather,
  swimming: Waves,
  poker: Spade,
  boardgames: Dices,
  gaming: Gamepad2,
  hike: Mountain,
  cycling: Bike,
  coffee: Coffee,
  shopping: ShoppingBag,
  concert: Ticket,
  music: Music,
  movies: Clapperboard,
  roadtrip: Car,
  food: UtensilsCrossed,
};

export function InterestIcon({ slug, size = 18 }: { slug: string; size?: number }) {
  const Icon = ICONS[slug] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}
