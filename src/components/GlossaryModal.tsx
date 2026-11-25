import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, ChevronLeft, ChevronRight, Lightbulb, Search, X } from 'lucide-react';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_ENTRIES,
  type GlossaryCategory,
} from '../data/glossary';

interface GlossaryModalProps {
  onClose: () => void;
}

const CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  basics: '棋盘与规则',
  openings: '开局定式',
  terms: '战术术语',
  checkmates: '杀法与残局',
  proverbs: '民间棋谚',
};

export const GlossaryModal: React.FC<GlossaryModalProps> = ({ onClose }) => {
  const [category, setCategory] = useState<'all' | GlossaryCategory>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(GLOSSARY_ENTRIES[0].id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY_ENTRIES.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q) ||
        entry.detail.toLowerCase().includes(q) ||
        entry.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [category, query]);

  // Keep a valid entry selected when switching category or searching
  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((e) => e.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const activeIndex = filtered.findIndex((e) => e.id === selectedId);
  const activeEntry = activeIndex >= 0 ? filtered[activeIndex] : filtered[0] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' && activeIndex >= 0 && activeIndex < filtered.length - 1) {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT') return;
        e.preventDefault();
        setSelectedId(filtered[activeIndex + 1].id);
      } else if (e.key === 'ArrowUp' && activeIndex > 0) {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT') return;
        e.preventDefault();
        setSelectedId(filtered[activeIndex - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, activeIndex, filtered]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glossary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="glossary-header">
          <div className="glossary-title-group">
            <div className="glossary-title">
              <BookMarked size={20} />
              <span>象棋词典</span>
            </div>
            <span className="glossary-sub">点击左侧词条即可在右侧大字精读</span>
          </div>
          <button
            type="button"
            className="glossary-close"
            onClick={onClose}
            title="关闭词典 (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Clean 5-Chapter Tabs */}
        <div className="glossary-toolbar">
          <div className="glossary-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="搜词条、规则、杀法或俏皮话（如：肋道、马后炮、一车十子寒…）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="glossary-clear" onClick={() => setQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <div className="glossary-tabs">
            {GLOSSARY_CATEGORIES.map((c) => {
              const count =
                c.key === 'all'
                  ? GLOSSARY_ENTRIES.length
                  : GLOSSARY_ENTRIES.filter((e) => e.category === c.key).length;
              return (
                <button
                  key={c.key}
                  type="button"
                  className={category === c.key ? 'active' : ''}
                  onClick={() => setCategory(c.key)}
                >
                  {c.label} <span className="glossary-tab-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Master-Detail Reader Body */}
        {filtered.length === 0 ? (
          <div className="glossary-empty">
            未找到包含「{query}」的词条，换个关键词试试吧（例如：棋盘、炮、马、杀法、俏皮话）。
          </div>
        ) : (
          <div className="glossary-body">
            {/* Left Index List */}
            <nav className="glossary-sidebar" aria-label="词条目录">
              {filtered.map((entry) => {
                const isSelected = activeEntry?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`glossary-nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <div className="glossary-nav-top">
                      <span className="glossary-nav-title">{entry.title}</span>
                      <span className={`glossary-cat ${entry.category}`}>
                        {CATEGORY_LABEL[entry.category]}
                      </span>
                    </div>
                    <p className="glossary-nav-preview">{entry.summary}</p>
                  </button>
                );
              })}
            </nav>

            {/* Right Large-Text Reading Pane */}
            {activeEntry && (
              <article className="glossary-reader">
                <div className="glossary-reader-meta">
                  <span className={`glossary-cat ${activeEntry.category}`}>
                    {CATEGORY_LABEL[activeEntry.category]}
                  </span>
                  <span className="glossary-reader-index">
                    {activeIndex + 1} / {filtered.length}
                  </span>
                </div>

                <h2 className="glossary-reader-title">{activeEntry.title}</h2>

                <div className="glossary-reader-summary">{activeEntry.summary}</div>

                <div className="glossary-reader-detail">{activeEntry.detail}</div>

                {activeEntry.tip && (
                  <div className="glossary-reader-tip">
                    <Lightbulb size={16} />
                    <div>
                      <strong>实战小贴士</strong>
                      <p>{activeEntry.tip}</p>
                    </div>
                  </div>
                )}

                {activeEntry.keywords.length > 0 && (
                  <div className="glossary-keywords">
                    {activeEntry.keywords.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => {
                          setCategory('all');
                          setQuery(kw);
                        }}
                        title={`搜索包含「${kw}」的相关词条`}
                      >
                        # {kw}
                      </button>
                    ))}
                  </div>
                )}

                <div className="glossary-reader-footer">
                  <button
                    type="button"
                    className="wood-btn"
                    disabled={activeIndex <= 0}
                    onClick={() => setSelectedId(filtered[activeIndex - 1].id)}
                  >
                    <ChevronLeft size={15} />
                    上一条
                  </button>
                  <button
                    type="button"
                    className="wood-btn"
                    disabled={activeIndex >= filtered.length - 1}
                    onClick={() => setSelectedId(filtered[activeIndex + 1].id)}
                  >
                    下一条
                    <ChevronRight size={15} />
                  </button>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
