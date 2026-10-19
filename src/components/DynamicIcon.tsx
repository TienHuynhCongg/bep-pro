import React from 'react';
import {
  Utensils,
  ChefHat,
  Flame,
  Coffee,
  Soup,
  ListChecks,
  Archive,
  BarChart3,
  Sliders,
  Settings,
  ClipboardList,
  Thermometer,
  Sparkles,
  Layers,
  BookOpen,
  Warehouse,
  ShieldCheck,
  Bell,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Users,
  UserCheck,
  Lock,
  FolderOpen,
  HelpCircle,
  LucideProps
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Utensils,
  ChefHat,
  Flame,
  Coffee,
  Soup,
  ListChecks,
  Archive,
  BarChart3,
  Sliders,
  Settings,
  ClipboardList,
  Thermometer,
  Sparkles,
  Layers,
  BookOpen,
  Warehouse,
  ShieldCheck,
  Bell,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Users,
  UserCheck,
  Lock,
  FolderOpen,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

interface DynamicIconProps extends LucideProps {
  name: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  const IconComponent = ICON_MAP[name] || HelpCircle;
  return <IconComponent {...props} />;
};
