'use client';

import { useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LibraryBig,
  MousePointerClick,
  Volume2,
} from 'lucide-react';

import { Button } from './button';

type Hotspot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  audio: string;
  label: string;
};

type BookPage = {
  number: number;
  image: string;
  hotspots: Hotspot[];
};

type BookData = {
  id: string;
  volume: string;
  shortTitle: string;
  title: string;
  totalPages: number;
  totalHotspots: number;
  chapters: { title: string; page: number }[];
  pages: BookPage[];
};

export type SeriesData = {
  title: string;
  subtitle: string;
  totalBooks: number;
  totalPages: number;
  totalHotspots: number;
  books: BookData[];
};

const zoomOptions = [80, 100, 125, 150];

export default function Home({ series }: { series: SeriesData }) {
  const [currentBookId, setCurrentBookId] = useState(series.books[0].id);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState('auto');
  const [wideScreen, setWideScreen] = useState(false);
  useEffect(() => {
    const reader = document.querySelector('.reader-scroll');
    if (!reader) return;
    const observer = new ResizeObserver(entries => {
      setWideScreen(entries[0].contentRect.width >= 960);
    });
    observer.observe(reader);
    return () => observer.disconnect();
  }, []);
  const doublePage = viewMode === 'double' || (viewMode === 'auto' && wideScreen);
  const [activeAudio, setActiveAudio] = useState<Hotspot | null>(null);
  const continuousRef = useRef(true);
  const previewRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playVersion, setPlayVersion] = useState(0);
  const [message, setMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const book = series.books.find((item) => item.id === currentBookId) ?? series.books[0];
  const page = book.pages[currentPage - 1] ?? book.pages[0];
  const spreadStart = currentPage === 1 ? 1 : currentPage - currentPage % 2;
  const visiblePages = doublePage && currentPage > 1
    ? book.pages.slice(spreadStart - 1, spreadStart + 1) : [page];
  const previousPage = doublePage ? (spreadStart <= 2 ? 1 : spreadStart - 2) : currentPage - 1;
  const nextPage = doublePage ? (currentPage === 1 ? 2 : spreadStart + 2) : currentPage + 1;
  const queue = book.pages.flatMap(p => p.hotspots.map(h => ({ page: p.number, hotspot: h })));

  useEffect(() => {
    if (!activeAudio) { setPlaying(false); return; }
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    audio.play().catch(() => {
      if (!cancelled) { setPlaying(false); setMessage('播放未成功，請按播放重試'); }
    });
    return () => { cancelled = true; audio.pause(); };
  }, [activeAudio, playVersion]);

  useEffect(() => {
    document.querySelector('.audio-hotspot[data-active="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeAudio]);
  const currentChapter = [...book.chapters]
    .reverse()
    .find((chapter) => chapter.page <= currentPage) ?? book.chapters[0];

  useEffect(() => {
    const savedBook = window.localStorage.getItem('taigi-series-book');
    const initialBook = series.books.find((item) => item.id === savedBook) ?? series.books[0];
    const savedPage = Number(window.localStorage.getItem(`taigi-series-page-${initialBook.id}`));
    setCurrentBookId(initialBook.id);
    setCurrentPage(
      Number.isFinite(savedPage) && savedPage > 0 && savedPage <= initialBook.totalPages
        ? savedPage
        : 1,
    );
  }, []);

  const goToPage = (number: number) => {
    audioRef.current?.pause();
    setMessage('');
    const next = Math.min(Math.max(number, 1), book.totalPages);
    setCurrentPage(next);
    setActiveAudio(null);
    window.localStorage.setItem(`taigi-series-page-${book.id}`, String(next));
    document.querySelector('.reader-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectBook = (bookId: string) => {
    audioRef.current?.pause();
    setMessage('');
    const nextBook = series.books.find((item) => item.id === bookId);
    if (!nextBook) return;
    const savedPage = Number(window.localStorage.getItem(`taigi-series-page-${bookId}`));
    setCurrentBookId(bookId);
    setCurrentPage(
      Number.isFinite(savedPage) && savedPage > 0 && savedPage <= nextBook.totalPages
        ? savedPage
        : 1,
    );
    setActiveAudio(null);
    window.localStorage.setItem('taigi-series-book', bookId);
    document.querySelector('.reader-scroll')?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goToPage(previousPage);
      if (event.key === 'ArrowRight') goToPage(nextPage);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const playAudio = (hotspot: Hotspot) => {
    audioRef.current?.pause();
    previewRef.current?.pause();
    continuousRef.current = true;
    setMessage('');
    setActiveAudio(hotspot);
    setPlayVersion(v => v + 1);
  };

  const playEntry = (entry: typeof queue[number]) => {
    setCurrentPage(entry.page);
    window.localStorage.setItem(`taigi-series-page-${book.id}`, String(entry.page));
    playAudio(entry.hotspot);
  };

  const advance = () => {
    setPlaying(false);
    if (!continuousRef.current || !activeAudio) return;
    const index = queue.findIndex(entry => entry.hotspot.id === activeAudio.id);
    const next = queue[index + 1];
    const nextTopicPage = book.chapters.find(chapter => chapter.page > currentPage)?.page ?? Infinity;
    if (index >= 0 && next && next.page < nextTopicPage) playEntry(next);
    else setMessage('本單元已播放完畢');
  };

  const togglePlayback = () => {
    previewRef.current?.pause();
    continuousRef.current = true;
    const audio = audioRef.current;
    if (activeAudio && audio) {
      if (!audio.paused) audio.pause();
      else {
        setMessage('');
        audio.play().catch(() => setMessage('播放未成功，請重試或點選另一段'));
      }
    } else {
      const topicEnd = book.chapters.find(chapter => chapter.page > currentPage)?.page ?? Infinity;
      const entry = queue.find(item => item.page >= currentPage && item.page < topicEnd);
      if (entry) playEntry(entry);
      else setMessage('本單元目前頁面之後沒有可播放的音頻');
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <BookOpen />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{series.title} · {book.volume} · <a href="./about.html">來源與授權</a></p>
          <h1 className="truncate">{book.title}</h1>
        </div>
        <div className="topbar-hint hidden lg:flex">
          <MousePointerClick />
          <span>點教材內的藍色字播放</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="chapter-panel">
          <div className="panel-title">
            <span>教材選冊</span>
            <span className="panel-count">全 {series.totalBooks} 冊</span>
          </div>
          <nav aria-label="教材選冊" className="chapter-list">
            {series.books.map((item, index) => (
              <div key={item.id}>
                <button
                  type="button"
                  className="chapter-link"
                  data-active={book.id === item.id}
                  onClick={() => selectBook(item.id)}
                >
                  <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <strong className="book-short-title">{item.shortTitle}</strong>
                    <small>{item.totalPages} 頁 · {item.totalHotspots} 段發音</small>
                  </span>
                </button>
                {book.id === item.id ? (
                  <div className="chapter-sublist" aria-label={`${item.shortTitle}單元`}>
                    {item.chapters.map((chapter) => (
                      <button
                        type="button"
                        key={`${item.id}-${chapter.title}-${chapter.page}`}
                        className="chapter-sub-link"
                        data-active={currentChapter.title === chapter.title && currentChapter.page === chapter.page}
                        onClick={() => goToPage(chapter.page)}
                      >
                        <span>{chapter.title}</span>
                        <small>第 {chapter.page} 頁</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>

          <div className="sidebar-note">
            <Volume2 />
            <p>本頁有 <strong>{page.hotspots.length}</strong> 個可播放項目。</p>
          </div>
          <div className="sidebar-note series-summary">
            <LibraryBig />
            <p>全系列共 <strong>{series.totalPages}</strong> 頁、<strong>{series.totalHotspots}</strong> 個發音點。</p>
          </div>
        </aside>

        <section className="reader-column" aria-label="教材閱讀器">
          <div className="reader-toolbar">
            <div className="mobile-chapter">
              <label htmlFor="book-select">選冊</label>
              <select
                id="book-select"
                value={book.id}
                onChange={(event) => selectBook(event.target.value)}
              >
                {series.books.map((item) => (
                  <option key={item.id} value={item.id}>{item.shortTitle}</option>
                ))}
              </select>
              <select
                aria-label="選擇單元"
                value={`${currentChapter.title}-${currentChapter.page}`}
                onChange={(event) => {
                  const chapter = book.chapters.find(
                    (item) => `${item.title}-${item.page}` === event.target.value,
                  );
                  if (chapter) goToPage(chapter.page);
                }}
              >
                {book.chapters.map((chapter) => (
                  <option key={`${chapter.title}-${chapter.page}`} value={`${chapter.title}-${chapter.page}`}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="page-controls">
              <Button
                variant="outline"
                size="icon"
                aria-label="上一頁"
                disabled={currentPage <= 1}
                onClick={() => goToPage(previousPage)}
              >
                <ChevronLeft />
              </Button>
              <label className="page-picker">
                <span className="sr-only">跳至頁面</span>
                <select
                  value={currentPage}
                  onChange={(event) => goToPage(Number(event.target.value))}
                >
                  {book.pages.map((item) => (
                    <option key={item.number} value={item.number}>第 {item.number} 頁</option>
                  ))}
                </select>
                <span>/ {book.totalPages}</span>
              </label>
              <Button
                variant="outline"
                size="icon"
                aria-label="下一頁"
                disabled={nextPage > book.totalPages}
                onClick={() => goToPage(nextPage)}
              >
                <ChevronRight />
              </Button>
            </div>

            <label className="view-control">
              <span className="sr-only">頁面模式</span>
              <select aria-label="頁面模式" value={viewMode} onChange={event => setViewMode(event.target.value)}>
                <option value="auto">自動單／雙頁</option>
                <option value="single">單頁</option>
                <option value="double">雙頁</option>
              </select>
            </label>
            <label className="zoom-control">
              <span>顯示大小</span>
              <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
                {zoomOptions.map((value) => (
                  <option key={value} value={value}>{value}%</option>
                ))}
              </select>
            </label>
          </div>

          <div className="reader-scroll">
            <div className="page-spread" data-double={doublePage} style={{ '--spread-zoom': zoom + '%' } as React.CSSProperties}>
            {visiblePages.map(visiblePage => <div key={visiblePage.number}
              className="page-stage"
              style={{ '--reader-width': `${zoom * 12}px`, '--mobile-reader-width': `${zoom}%` } as React.CSSProperties}
            >
              <img
                src={visiblePage.image}
                alt={`${book.title}第 ${visiblePage.number} 頁`}
                draggable={false}
              />
              <div className="hotspot-layer" aria-label="頁面發音按鈕">
                {visiblePage.hotspots.map((hotspot) => (
                  <button
                    type="button"
                    key={hotspot.id}
                    className="audio-hotspot"
                    data-active={activeAudio?.id === hotspot.id}
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      width: `${hotspot.width}%`,
                      height: `${hotspot.height}%`,
                    }}
                    aria-label={`播放發音 ${hotspot.label}`}
                    title={`播放 ${hotspot.label}`}
                    onClick={() => playEntry({ page: visiblePage.number, hotspot })}
                  />
                ))}
              </div>
            </div>)}
            </div>
          </div>
        </section>
      </div>

      <footer className="audio-dock" data-active={Boolean(activeAudio)}>
        <div className="audio-status">
          <span className="audio-icon"><Volume2 /></span>
          <div>
            <p role="status">{message || (activeAudio ? `${playing ? '正在播放' : '已暫停／播放結束'} ${book.shortTitle} 教材發音` : '尚未選擇發音')}</p>
            <strong>{activeAudio?.label ?? '點擊教材中的藍色文字即可播放'}</strong>
          </div>
        </div>
        <div className="playback-controls">
          <button type="button" className="global-playback" onClick={togglePlayback} aria-label={playing ? '暫停連續播放' : '連續播放'}>{playing ? '❚❚ 暫停' : '▶ 連續播放'}</button>
          <small>播至本單元結束後自動暫停</small>
        </div>
        {activeAudio ? (
          <div className="single-player">
            <button className="single-replay" type="button" onClick={() => { const audio = previewRef.current; if (audio) { continuousRef.current = false; audioRef.current?.pause(); audio.currentTime = 0; audio.play().catch(() => setMessage('單段播放未成功，請重試')); } }}>↺ 重播單段</button>
            <audio className="single-audio" ref={previewRef} key={`preview-${playVersion}`} controls preload="metadata" src={activeAudio.audio} onPlay={() => { continuousRef.current = false; audioRef.current?.pause(); setPlaying(false); setMessage('單段播放'); }} onEnded={() => setMessage('單段播放結束，可按右側播放重聽')} />
            <audio className="continuous-audio" ref={audioRef} key={playVersion} preload="auto" src={activeAudio.audio} onPlay={() => { previewRef.current?.pause(); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={advance} onError={() => { setPlaying(false); setMessage('音頻讀取失敗，請重試或點選另一段'); }} />
          </div>
        ) : (
          <div className="audio-placeholder">音檔會在這裡播放，不會另開分頁</div>
        )}
      </footer>
    </main>
  );
}
