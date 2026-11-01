"""Build a navigable index from explicitly published example types."""
from collections import OrderedDict
from html import escape


def page(catalog, publications, brand):
    h = lambda value: escape(str(value), quote=True)
    volumes = OrderedDict((c['volume'], []) for c in catalog)
    for lesson in publications:
        volumes[lesson['volume']].append(lesson)
    volumes = {volume: lessons for volume, lessons in volumes.items() if lessons}
    sections = []
    type_count = 0
    for volume, lessons in volumes.items():
        lesson_sections = []
        for lesson in lessons:
            families = OrderedDict()
            for q in lesson['questions']:
                families.setdefault(q['type_family'], OrderedDict()).setdefault(q['type_id'], []).append(q)
            rows = []
            for family, types in families.items():
                for type_id, questions in types.items():
                    q = questions[0]
                    type_count += 1
                    search = ' '.join([volume, lesson['title'], lesson['id'], family, q['type_title'], q['type_note']]
                                      + [item['id'] + ' ' + item['title'] for item in questions]).lower()
                    urls = ''.join(f'<a href="chapters/{h(lesson["id"])}-{edition}.html#type-{h(type_id)}">{label} ↗</a>'
                                   for edition, label in (('teacher', '教师版'), ('student', '学生版')))
                    qids = ' · '.join(item['id'] for item in questions)
                    rows.append(f'''<article class="type-index-item" data-search="{h(search)}" data-volume="{h(volume)}">
<p class="type-index-family">{h(family)}</p><h4>{h(q['type_title'])}</h4><p>{h(q['type_note'])}</p>
<div class="type-index-bottom"><span>{len(questions)}道公开例训 · {h(qids)}</span><nav aria-label="{h(q['type_title'])}版本选择">{urls}</nav></div></article>''')
            lesson_sections.append(f'<section class="type-index-lesson" id="lesson-{h(lesson["id"])}"><h3>{h(lesson["title"])} <small>{h(lesson["id"])}</small></h3><div class="type-index-grid">{"".join(rows)}</div></section>')
        sections.append(f'<section class="type-index-volume"><h2>{h(volume)}</h2>{"".join(lesson_sections)}</section>')
    options = ''.join(f'<option value="{h(v)}">{h(v)}</option>' for v in volumes)
    question_count = sum(len(lesson['questions']) for lesson in publications)
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>公开题型总览 · 高中数学解析字典</title><link rel="stylesheet" href="assets/site.css"><link rel="stylesheet" href="assets/type-index.css"><script defer src="assets/type-index.js"></script></head>
<body><header class="topbar">{brand()}<div class="top-right"><span class="edition">公开例训索引</span><a href="index.html">返回全书 ↗</a></div></header>
<main class="type-index-page"><header class="type-index-intro"><span class="eyebrow">FIND YOUR STARTING POINT</span><h1>从题型找到方法</h1><p>按板块、问题与处理路线浏览已公开例训。先找到熟悉的条件，再进入对应讲义比较同型题。</p><div><b>{len(volumes)}</b> 个已公开例训板块 <b>{type_count}</b> 个细题型 <b>{question_count}</b> 道自编例训</div></header>
<p class="type-index-scope">这里仅收录已公开的自编例训；不代表全高中题型已经覆盖，未列出不等于不存在。题目难度尚未标定，学生版保留方法提示。</p>
<section class="type-index-controls" aria-label="筛选公开题型"><label>搜索题型或题号<input id="type-query" type="search" placeholder="例如：定和、射影、Q901" autocomplete="off"></label><label>板块<select id="type-volume"><option value="">全部已公开板块</option>{options}</select></label><button type="button" id="type-clear">清除筛选</button><p id="type-count" role="status" aria-live="polite">显示全部 {type_count} 个公开细题型。</p></section>
<noscript><p class="type-index-scope">未启用JavaScript时仍可浏览和打开全部题型；筛选功能需要启用JavaScript。</p></noscript>
<div class="type-index-content">{''.join(sections)}</div><p id="type-empty" hidden>没有匹配的公开题型。试试缩短关键词；不代表数学上不存在这一类问题。</p><footer class="type-index-footer"><a href="index.html">← 返回全书</a><a href="knowledge.html">查找知识卡 ↗</a></footer></main></body></html>'''
