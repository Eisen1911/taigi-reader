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
  leftImage: string;
  rightImage: string;
  splitRatio: number;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [singleControlsOpen, setSingleControlsOpen] = useState(false);
  const [pageSide, setPageSide] = useState(1);
  const [viewMode, setViewMode] = useState('auto');
  const [desktopLayout, setDesktopLayout] = useState(false);
  const [wideScreen, setWideScreen] = useState(false);
  useEffect(() => {
    const reader = document.querySelector('.reader-scroll');
    if (!reader) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      const desktop = window.matchMedia('(min-width:901px) and (min-height:501px), (min-width:1101px)').matches;
      setDesktopLayout(desktop);
      setWideScreen(desktop ? width / (zoom / 100) >= 960 : width >= 960 || (width >= 700 && window.innerWidth > window.innerHeight));
    });
    observer.observe(reader);
    return () => observer.disconnect();
  }, [zoom]);
  useEffect(() => {
    if (!desktopLayout) return;
    const reader = document.querySelector('.reader-column');
    if (!reader) return;
    let lastStep = -Infinity;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) return;
      // Use a non-passive listener to prevent browser zoom only inside the reader.
      event.preventDefault();
      const now = performance.now();
      if (now - lastStep < 150) return;
      lastStep = now;
      setZoom(value => {
        const index = zoomOptions.indexOf(value);
        const next = Math.max(0, Math.min(zoomOptions.length - 1, index + (event.deltaY < 0 ? 1 : -1)));
        return zoomOptions[next];
      });
    };
    reader.addEventListener('wheel', onWheel, { passive: false });
    return () => reader.removeEventListener('wheel', onWheel);
  }, [desktopLayout]);
  const doublePage = desktopLayout ? wideScreen : viewMode === 'double' || (viewMode === 'auto' && wideScreen);
  const [activeAudio, setActiveAudio] = useState<Hotspot | null>(null);
  const continuousRef = useRef(true);
  const previewRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playVersion, setPlayVersion] = useState(0);
  const [message, setMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const book = series.books.find((item) => item.id === currentBookId) ?? series.books[0];
  const page = book.pages[currentPage - 1] ?? book.pages[0];
  const turnPage = (direction: number) => {
    if (!doublePage && direction === 1 && pageSide === 0) {
      goToPage(currentPage); setPageSide(1);
    } else if (!doublePage && direction === -1 && pageSide === 1 && currentPage > 1) {
      goToPage(currentPage); setPageSide(0);
    } else {
      goToPage(currentPage + direction);
      setPageSide(direction < 0 || currentPage + direction === 1 ? 1 : 0);
    }
  };
  const splitPercent = (page.splitRatio ?? 0.5) * 100;
  const visibleHotspots = doublePage ? page.hotspots : page.hotspots.filter(h =>
    (h.x + h.width / 2 >= splitPercent ? 1 : 0) === pageSide);
  const pageOffset = pageSide === 0 ? 0 : splitPercent;
  const pageScale = 100 / (pageSide === 0 ? splitPercent : 100 - splitPercent);
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
    setPageSide(savedPage > 1 ? 0 : 1);
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
    setPageSide(next === 1 ? 1 : 0);
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
    setPageSide(savedPage > 1 ? 0 : 1);
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
      if (event.key === 'ArrowLeft') turnPage(-1);
      if (event.key === 'ArrowRight') turnPage(1);
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
    setPageSide(entry.hotspot.x + entry.hotspot.width / 2 >= 50 ? 1 : 0);
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
      const entry = queue.find(item => item.page >= currentPage && item.page < topicEnd && (doublePage || item.page > currentPage || (item.hotspot.x + item.hotspot.width / 2 >= 50 ? 1 : 0) >= pageSide));
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
          <div className="reader-toolbar" data-settings-open={settingsOpen}>
            <button type="button" className="mobile-settings-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(v => !v)}>{settingsOpen ? '收起設定' : '目錄・設定'}</button><div className="mobile-chapter">
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
                onClick={() => turnPage(-1)}
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
                    <option key={item.number} value={item.number}>第 {item.number} 組</option>
                  ))}
                </select>
                <span>/ {book.totalPages}{!doublePage ? (pageSide === 0 ? " · 左頁" : " · 右頁") : ""}</span>
              </label>
              <Button
                variant="outline"
                size="icon"
                aria-label="下一頁"
                disabled={currentPage >= book.totalPages && (doublePage || pageSide === 1)}
                onClick={() => turnPage(1)}
              >
                <ChevronRight />
              </Button>
            </div>

            <a className="mobile-about" href="./about.html">來源與授權</a><label className="view-control">
              <span className="sr-only">頁面模式</span>
              <select aria-label="頁面模式" value={viewMode} onChange={event => setViewMode(event.target.value)}>
                <option value="auto">自動單／雙頁</option>
                <option value="single">單頁</option>
                <option value="double">雙頁</option>
              </select>
            </label>
            <label className="zoom-control" title="閱讀區內按住 Ctrl 並滾動滑鼠滾輪可縮放教材">
              <span>顯示大小</span>
              <select aria-label="顯示大小" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
                {zoomOptions.map((value) => (
                  <option key={value} value={value}>{value}%</option>
                ))}
              </select>
            </label>
          </div>

          <div className="reader-scroll">
            <div className="physical-page" data-double={doublePage} data-side={pageSide} style={{ '--physical-width': zoom + '%' } as React.CSSProperties}>
            <div className="page-stage">
              <img
                src={doublePage ? page.image : pageSide === 0 ? page.leftImage : page.rightImage}
                alt={`${book.title}第 ${page.number} 組${doublePage ? "雙頁" : pageSide === 0 ? "左頁" : "右頁"}`}
                draggable={false}
              />
              <div className="hotspot-layer" aria-label="頁面發音按鈕">
                {visibleHotspots.map((hotspot) => (
                  <button
                    type="button"
                    key={hotspot.id}
                    className="audio-hotspot"
                    data-active={activeAudio?.id === hotspot.id}
                    style={{
                      left: `${doublePage ? hotspot.x : (hotspot.x - pageOffset) * pageScale}%`,
                      top: `${hotspot.y}%`,
                      width: `${doublePage ? hotspot.width : hotspot.width * pageScale}%`,
                      height: `${hotspot.height}%`,
                    }}
                    aria-label={`播放發音 ${hotspot.label}`}
                    title={`播放 ${hotspot.label}`}
                    onClick={() => playEntry({ page: page.number, hotspot })}
                  />
                ))}
              </div>
            </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="audio-dock" data-active={Boolean(activeAudio)} data-single-open={singleControlsOpen} data-message={Boolean(message)}><button type="button" className="mobile-audio-toggle" disabled={!activeAudio} aria-expanded={singleControlsOpen} onClick={() => setSingleControlsOpen(v => !v)}>{singleControlsOpen ? '收起' : '單段控制'}</button>
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
