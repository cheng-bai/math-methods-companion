"""Publish only reviewed author-written knowledge cards and catalog metadata."""
from collections import OrderedDict
from html import escape
import hashlib
import re


def validate(data, catalog):
    if set(data) != {'version', 'notice', 'cards'}:
        raise ValueError('知识卡公开输入字段不符合白名单')
    ids = set()
    chapters = {c['id']: c for c in catalog}
    fields = {'id', 'title', 'volume', 'section', 'chapters', 'formula', 'recognize', 'caution'}
    for card in data['cards']:
        if set(card) != fields:
            raise ValueError('知识卡不能携带私有回源或题库字段')
        if not re.fullmatch(r'k-[a-f0-9]{8}', card['id']) or card['id'] in ids:
            raise ValueError('知识卡ID须稳定且唯一')
        ids.add(card['id'])
        for field in fields - {'chapters'}:
            if not isinstance(card[field], str) or not card[field].strip():
                raise ValueError(f'知识卡字段为空或类型不符: {field}')
        if not card['chapters'] or any(c not in chapters for c in card['chapters']):
            raise ValueError('知识卡关联目录不存在')


def section_anchor(section):
    identity = section.split(' ', 1)[0]
    return 'section-' + hashlib.sha256(identity.encode()).hexdigest()[:8]


def page(data, catalog, markdown, brand, example_links=()):
    h = lambda value: escape(str(value), quote=True)
    validate(data, catalog)
    groups = OrderedDict()
    for card in data['cards']:
        groups.setdefault(card['volume'], []).append(card)
    nav, sections = [], []
    for volume, cards in groups.items():
        number, title = volume.split(' ', 1)
        nav.append(f'<a href="#group-{h(number)}">{h(title)}<span>{len(cards):02}</span></a>')
        topic_rows = OrderedDict()
        for card in cards:
            examples = []
            for row in example_links:
                if row['card_id'] != card['id']:
                    continue
                routes = ''.join(f'<a href="chapters/{h(row["chapter_id"])}-{edition}.html#{h(row["question_id"].lower())}" aria-label="{h(row["question_id"])}{label}">{label} ↗</a>' for edition, label in (('teacher', '教师版'), ('student', '学生版')))
                examples.append(f'<li><div><b>{h(row["question_id"])}</b><span>{h(row["focus"])}</span></div><nav aria-label="{h(row["question_id"])}版本选择">{routes}</nav></li>')
            example_html = ('<section class="knowledge-examples"><h3>公开例训 · 对应动作</h3><p>只对应下列动作，不代表本知识点或题型已完整覆盖。</p><ul>' + ''.join(examples) + '</ul></section>') if examples else ''
            chapter_links = ''.join(f'<a href="index.html?catalog={h(c)}#catalogue">{h(c)}</a>' for c in card['chapters'])
            search = h(' '.join(card[k] for k in ('title', 'volume', 'section', 'formula', 'recognize', 'caution')).lower())
            topic_rows.setdefault(card['section'], []).append(f'''<details class="knowledge-card" id="{h(card['id'])}" data-search="{search}">
<summary><span><small>{h(card['section'])}</small><p>{h(card['title'].replace('$', ''))}</p></span><span class="card-action" aria-hidden="true">＋</span></summary>
<div class="knowledge-detail"><p class="math-state" role="status"></p><div class="knowledge-formula">{markdown(card['formula'])}</div>
<div class="knowledge-notes"><section><h3>什么时候用</h3>{markdown(card['recognize'])}</section><section class="knowledge-caution"><h3>别踩这个坑</h3>{markdown(card['caution'])}</section></div>
{example_html}
<div class="knowledge-context"><span>全书位置 · 相关讲目录（正文未公开）</span>{chapter_links}<a class="permalink" href="#{h(card['id'])}">定位此卡 ↗</a></div></div></details>''')
        topic_nav = ''.join(f'<a href="#{section_anchor(section)}">{h(section.split(" ", 1)[-1])}</a>' for section in topic_rows)
        rows = ''.join(f'<section class="knowledge-topic" id="{section_anchor(section)}"><h3>{h(section)}</h3>{"".join(items)}</section>' for section, items in topic_rows.items())
        sections.append(f'<section class="knowledge-group" id="group-{h(number)}" data-volume="{h(volume)}"><header><span>{h(number)}</span><h2>{h(title)}</h2><small>{len(cards)} 张知识卡</small></header><nav class="knowledge-topic-nav" aria-label="{h(title)}主题跳转">{topic_nav}</nav>{rows}</section>')
    options = ''.join(f'<option value="{h(v)}">{h(v)}</option>' for v in groups)
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>知识速查 · 高中数学解析字典</title><link rel="stylesheet" href="assets/site.css"><link rel="stylesheet" href="assets/knowledge.css"><script defer src="assets/knowledge.js"></script></head>
<body id="top"><header class="topbar">{brand()}<div class="top-right"><span class="edition">编者知识速查</span><a href="index.html">全书目录 ↗</a></div></header>
<div class="knowledge-layout"><aside class="knowledge-nav"><span class="eyebrow">THE KNOWLEDGE DESK</span><h2>知识索引</h2><p>先看条件，再看公式。</p><nav aria-label="知识板块跳转">{''.join(nav)}</nav><a class="nav-back" href="index.html">← 全书{len(catalog)}讲目录</a><p>已有知识卡的{len(groups)}个板块，<br>不是全高中完整覆盖。</p></aside>
<main class="knowledge-main"><div class="knowledge-breadcrumb"><a href="index.html">全书</a> / 编者知识速查</div><header class="knowledge-intro"><span class="eyebrow">FORMULA · RECOGNITION · BOUNDARY</span><h1>记住公式，<em>更要看清条件。</em></h1><p>{len(data['cards'])} 张已复核知识卡。用一句话认出问题，再核对公式与易错边界。题库原题未公开；部分知识卡附有自编公开例训，可直达师生版。</p><div class="knowledge-summary"><span><b>{len(groups):02}</b> 个板块</span><span><b>{len(data['cards']):02}</b> 张速查卡</span><span>按需展开 · 本地公式资源</span></div></header>
<section class="knowledge-tools" aria-label="筛选知识卡"><label for="knowledge-query">找知识、公式或易错点<input id="knowledge-query" type="search" placeholder="例如：负公比、共轭、向量 夹角" autocomplete="off"></label><label for="knowledge-volume">知识板块<select id="knowledge-volume"><option value="">全部板块</option>{options}</select></label><button id="knowledge-clear" type="button">清除筛选</button><p id="knowledge-count" role="status" aria-live="polite">{len(data['cards'])} 张知识卡</p></section>
<noscript><p>筛选和公式排版需要启用JavaScript；卡片文本仍可展开阅读。</p></noscript><div class="knowledge-content">{''.join(sections)}</div><p id="knowledge-empty" hidden>没有匹配的知识卡。试试缩短关键词；未命中不代表数学上没有这个知识点。</p>
<footer class="knowledge-footer"><p>{h(data['notice'])}</p><a href="#top">回到顶部 ↑</a><a href="index.html#public-lessons">按板块阅读公开例训 ↗</a></footer></main></div></body></html>'''
