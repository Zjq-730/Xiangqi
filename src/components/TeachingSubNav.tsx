import React from 'react';
import { BookOpen, GraduationCap, ScrollText, Swords } from 'lucide-react';

export type TeachingTab = 'lessons' | 'puzzles' | 'manuals' | 'coach';

interface TeachingSubNavProps {
  activeTab: TeachingTab;
  onSelectTab: (tab: TeachingTab) => void;
  lessonProgressText: string;
  puzzleProgressText: string;
  manualProgressText: string;
}

export const TeachingSubNav: React.FC<TeachingSubNavProps> = ({
  activeTab,
  onSelectTab,
  lessonProgressText,
  puzzleProgressText,
  manualProgressText,
}) => {
  const items: { key: TeachingTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: 'lessons', label: '基础微课', icon: <GraduationCap size={13} />, badge: lessonProgressText },
    { key: 'puzzles', label: '杀法闯关', icon: <Swords size={13} />, badge: puzzleProgressText },
    { key: 'manuals', label: '互动棋谱', icon: <ScrollText size={13} />, badge: manualProgressText },
    { key: 'coach', label: '实战陪练', icon: <BookOpen size={13} /> },
  ];

  return (
    <div className="teaching-subnav" role="tablist" aria-label="教学模式子菜单">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={activeTab === item.key}
          className={`teaching-subnav-btn ${activeTab === item.key ? 'active' : ''}`}
          onClick={() => onSelectTab(item.key)}
        >
          <span className="teaching-subnav-label">
            {item.icon}
            <span>{item.label}</span>
          </span>
          {item.badge && <span className="teaching-subnav-badge">{item.badge}</span>}
        </button>
      ))}
    </div>
  );
};
