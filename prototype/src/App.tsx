import { useMemo, useRef, useState } from "react";
import {
  CaretDown,
  CaretRight,
  FileArrowUp,
  List,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";

type Part = {
  id: string;
  title: string;
  chapters: string[];
};

type ChapterContent = {
  subtitle: string;
  intro: string[];
};

type TreeGroupProps = {
  part: Part;
  active: string;
  onSelect: (title: string) => void;
};

const parts: Part[] = [
  {
    id: "preface",
    title: "前言",
    chapters: [],
  },
  {
    id: "cognitive",
    title: "第一部分 认知革命",
    chapters: [
      "第1章 认知革命",
      "第2章 知善恶树",
      "第3章 亚当和夏娃的一天",
    ],
  },
  {
    id: "agriculture",
    title: "第二部分 农业革命",
    chapters: ["第4章 历史上最大的骗局", "第5章 金钱的气味", "第6章 帝国的愿景"],
  },
  {
    id: "unification",
    title: "第三部分 人类的融合统一",
    chapters: ["第7章 科学与帝国的结合", "第8章 资本主义教条", "第9章 追求永生"],
  },
  {
    id: "science",
    title: "第四部分 科学革命",
    chapters: ["第10章 科学的梦想", "第11章 无知之墙", "第12章 公平正义"],
  },
  {
    id: "modern",
    title: "第五部分 现代的困境",
    chapters: ["第13章 幸福的工业", "第14章 自由的悖论", "第15章 意义的追寻"],
  },
];

const paragraphs: Record<string, ChapterContent> = {
  "第1章 认知革命": {
    subtitle: "第一部分 认知革命",
    intro: [
      "大约七万年前，地球上至少有六个人种：非洲的智人、亚洲的直立人、欧洲的尼安德特人，以及丹尼索瓦人。此后，这些人种中只剩下智人这一种，并且成为人类谱系中唯一延续至今的分支。",
      "这并非因为智人比其他人更强壮、更聪明或更有创造力。事实上，我们的祖先在智力和体力方面都不如尼安德特人。那么为什么最终是我们继承了这个世界？答案只有一个：我们是唯一掌握了大规模合作的物种。",
    ],
  },
  "第2章 知善恶树": {
    subtitle: "第一部分 认知革命",
    intro: [
      "语言让智人能够分享关于世界的信息，也让我们开始谈论并不存在于眼前的事物。共同相信的故事，把互不相识的人连接到一起。",
      "神话、国家、法律与货币并非自然界中的实体，却能协调无数人的行动。虚构不是谎言，而是一套让群体稳定合作的共同协议。",
    ],
  },
  "第3章 亚当和夏娃的一天": {
    subtitle: "第一部分 认知革命",
    intro: [
      "采集社会留下的文字记录很少，但他们的生活并不等于贫乏。对季节、植物和动物的细密知识，构成了另一种复杂文明。",
      "理解他们的一天，不能只从现代人的效率尺度出发。劳动、迁徙、社交与仪式，共同塑造了早期人类的时间。",
    ],
  },
};

function TreeGroup({ part, active, onSelect }: TreeGroupProps) {
  const [open, setOpen] = useState(part.id !== "preface");
  const hasChildren = part.chapters.length > 0;

  return (
    <li className="tree-group">
      <button
        className="tree-parent"
        type="button"
        onClick={() => (hasChildren ? setOpen((value) => !value) : onSelect(part.title))}
        aria-expanded={hasChildren ? open : undefined}
      >
        {hasChildren ? (
          open ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />
        ) : (
          <span className="tree-icon-spacer" />
        )}
        <span>{part.title}</span>
      </button>
      {hasChildren && open && (
        <ul className="tree-children">
          {part.chapters.map((chapter) => (
            <li key={chapter}>
              <button
                type="button"
                className={chapter === active ? "tree-link is-active" : "tree-link"}
                onClick={() => onSelect(chapter)}
              >
                {chapter}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function App() {
  const [activeChapter, setActiveChapter] = useState("第1章 认知革命");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const chapter = useMemo(
    () => paragraphs[activeChapter] ?? paragraphs["第1章 认知革命"]!,
    [activeChapter],
  );

  const selectChapter = (title: string): void => {
    if (paragraphs[title]) setActiveChapter(title);
    setOutlineOpen(false);
    requestAnimationFrame(() => articleRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label="Scope 首页">Scope</a>
          <button className="book-entry" type="button" onClick={() => fileInputRef.current?.click()}>
            <MagnifyingGlass size={18} />
            <span>打开或搜索书籍 / 文件（例如：人类简史）</span>
            <span className="entry-shortcut">/</span>
          </button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".epub" />
          <nav className="top-actions" aria-label="页面操作">
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <FileArrowUp size={17} />
              <span>打开文件</span>
            </button>
            <button type="button" onClick={() => setAboutOpen(true)}>关于</button>
            <button className="outline-trigger" type="button" onClick={() => setOutlineOpen(true)}>
              <List size={19} />
              <span>目录</span>
            </button>
          </nav>
        </div>
      </header>

      <main id="top" className="reader-grid" data-testid="reader-grid">
        <article ref={articleRef} className="article" data-testid="article-column">
          <nav className="breadcrumbs" aria-label="章节路径">
            <a href="#top">首页</a><span>›</span>
            <a href="#top">人类简史</a><span>›</span>
            <a href="#top">{chapter.subtitle}</a><span>›</span>
            <span>{activeChapter}</span>
          </nav>

          <h1>{activeChapter}</h1>
          <p className="chapter-part">{chapter.subtitle}</p>

          {chapter.intro.map((text) => <p key={text}>{text}</p>)}

          <blockquote>
            合作的能力，让我们能够做出单靠个人无法完成的事情；合作的规模，让我们能够动员群体，完成其他动物望尘莫及的壮举。<sup><a href="#note-1">[1]</a></sup>
          </blockquote>

          <section id="stories">
            <h2>故事的力量</h2>
            <p>大约七万年前，智人已经在地球上生存了二十多万年。我们和其他人种的体型并无二致，生活在同样的生态环境中，为什么对其他人种来说是致命的竞争，在我们这里却变成了合作的机会？</p>
            <p>其中一个重要原因，是我们发明了一种独特的交流方式：虚构的故事。</p>
            <p>这听起来或许令人惊讶，但请想一想，我们生活在一个充满了人类虚构故事的世界里：国家、公司、法律、货币、人权、神、民族、自由市场……这些都是存在于集体想象中的故事。然而，正是这些故事，让我们能够凭借共同信念进行大规模协作。<sup><a href="#note-2">[2]</a></sup></p>
            <p>我们相信共同想象的故事，即便从未谋面的陌生人之间，也能建立信任与合作。</p>
          </section>

          <section id="tribes">
            <h2>从部落到国家</h2>
            <p>早期的人类小群体通常由几十个成员组成，彼此之间需要面对面交流，才能建立信任。但随着故事的出现，人类开始能够在更大规模上协作。</p>
            <p>例如，一面旗帜、一个国歌、一个共同的神话，就能把成千上万的陌生人凝聚在一起，为了共同的目标而奋斗。这种能力彻底改变了人类的历史轨迹，使我们能够建造城市、帝国，甚至探索宇宙。<sup><a href="#note-3">[3]</a></sup></p>
            <p>故事的力量并不在于它是否真实，而在于人们是否共同相信它。一旦足够多的人相信某个故事，它就会在现实世界中产生真实的力量。</p>
          </section>

          <section id="notes" className="notes">
            <h2>注释</h2>
            <ol>
              <li id="note-1">群体协作规模与认知能力之间存在持续的相互影响。</li>
              <li id="note-2">共同想象是社会制度得以延续的基础之一。</li>
              <li id="note-3">章节内容为界面原型演示文本。</li>
            </ol>
          </section>
        </article>

        <aside className={outlineOpen ? "outline is-open" : "outline"} data-testid="outline-column">
          <button className="drawer-close" type="button" onClick={() => setOutlineOpen(false)} aria-label="关闭目录">
            <X size={20} />
          </button>
          <div className="book-meta">
            <img
              src="/assets/sapiens-cover.png"
              alt="《人类简史》英文版封面"
            />
            <div>
              <h2>人类简史</h2>
              <p>尤瓦尔·赫拉利</p>
              <p>本地文件：人类简史.epub</p>
              <p>已读 18%</p>
            </div>
          </div>
          <div className="outline-heading">目录</div>
          <nav aria-label="本书章节">
            <ul className="chapter-tree">
              {parts.map((part) => (
                <TreeGroup key={part.id} part={part} active={activeChapter} onSelect={selectChapter} />
              ))}
              <li><button className="tree-parent tree-leaf" type="button">后记</button></li>
              <li><button className="tree-parent tree-leaf" type="button">致谢</button></li>
            </ul>
          </nav>
        </aside>
      </main>

      {outlineOpen && <button className="drawer-backdrop" type="button" aria-label="关闭目录" onClick={() => setOutlineOpen(false)} />}

      {aboutOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="dialog-close" onClick={() => setAboutOpen(false)} aria-label="关闭">
              <X size={20} />
            </button>
            <h2 id="about-title">关于 Scope</h2>
            <p>Scope 把本地图书渲染为自然滚动的内容网页。当前原型用于验证正文与章节树的紧凑双栏结构。</p>
            <button className="dialog-primary" type="button" onClick={() => setAboutOpen(false)}>知道了</button>
          </section>
        </div>
      )}
    </>
  );
}
