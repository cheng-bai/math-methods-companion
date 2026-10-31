"""Exercise multiple questions per type without modifying public demo content."""
import copy
import contextlib
import io
import tempfile
import importlib.util
import json
from pathlib import Path
import unittest
import sys
from html.parser import HTMLParser

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'scripts'))
spec = importlib.util.spec_from_file_location('build', root / 'scripts/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class Nodes(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.ids, self.links = [], {}, []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.stack.append((tag, attrs))
        if 'id' in attrs:
            self.ids[attrs['id']] = attrs
        if tag == 'a' and 'href' in attrs:
            ancestors = [attrs.get('id') for _, attrs in self.stack if attrs.get('id')]
            self.links.append((ancestors, attrs['href'], attrs.get('class', '')))
    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

class Grouping(unittest.TestCase):
    def test_grouped_navigation_and_counts(self):
        demo = json.loads((root / 'content/demo.json').read_text())
        catalog = json.loads((root / 'content/catalog.json').read_text())
        extra = copy.deepcopy(demo['questions'][0]); extra['id'] = 'Q04'
        # A second type in the same family and the same title in a different family.
        other = copy.deepcopy(extra); other['id'] = 'Q05'; other['type_title'] = '另一个方法'; other['type_id'] = 'other-method'
        third = copy.deepcopy(extra); third['id'] = 'Q06'; third['type_family'] = '另一个问题'; third['type_id'] = 'other-family'
        demo['questions'].extend([extra, other, third])
        for edition in ('teacher', 'student'):
            html = build.chapter_page(catalog, demo, edition)
            page = Nodes(); page.feed(html)
            for q, anchor in [('q01', 'type-fixed-sum-reciprocals'), ('q04', 'type-fixed-sum-reciprocals'), ('q05', 'type-other-method'), ('q06', 'type-other-family')]:
                self.assertIn(anchor, page.ids)
                self.assertTrue(any(q in ancestors and href == '#' + anchor and cls == 'question-type-link' for ancestors, href, cls in page.links))
                self.assertTrue(any(anchor in ancestors and href == '#' + q for ancestors, href, _ in page.links))
            self.assertIn('6道独立教学示例', html)
        # Reordering cannot change either the stable or the published legacy links.
        demo['questions'].reverse()
        page = Nodes(); page.feed(build.chapter_page(catalog, demo, 'teacher'))
        self.assertTrue(any('type-fixed-sum-reciprocals' in ancestors and href == '#q01' for ancestors, href, _ in page.links))
        self.assertIn('type-1-1', page.ids)
        html = build.chapter_page(catalog, demo, 'teacher')
        self.assertIn('id="type-fixed-sum-reciprocals"><span id="type-1-1"', html)
        home = build.homepage(catalog, demo)
        self.assertIn('这里只检索6道自编教学演示', home)
        self.assertIn('单列的6道自编演示', home)

    def test_invalid_and_colliding_ids_are_rejected(self):
        demo = json.loads((root / 'content/demo.json').read_text())
        dupe = copy.deepcopy(demo['questions'][0]); dupe['id'] = 'q01'
        demo['questions'].append(dupe)
        with self.assertRaisesRegex(ValueError, '重复的题号'):
            build.validate_demo(demo)
        demo['questions'][-1]['id'] = 'Q04'
        demo['questions'][-1]['type_title'] = '另一个类型'
        with self.assertRaisesRegex(ValueError, '不同分类'):
            build.validate_demo(demo)
        demo['questions'][-1]['type_id'] = 'other'
        demo['questions'][-1]['type_id'] = 'map'
        with self.assertRaisesRegex(ValueError, '无效的稳定题型ID'):
            build.validate_demo(demo)
        demo['questions'][-1]['type_id'] = 'other'
        demo['questions'][-1]['id'] = 'bad id'
        with self.assertRaisesRegex(ValueError, '无效或重复'):
            build.validate_demo(demo)

    def test_generated_html_duplicate_id_fails_check(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'index.html').write_text('<div id="type-map"></div><div id="type-map"></div>')
            report = io.StringIO()
            with contextlib.redirect_stdout(report), self.assertRaises(SystemExit):
                build.check(output, False, 0)
            self.assertIn('重复的HTML ID: type-map', report.getvalue())

class PublicKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.cards = json.loads((root / 'content/knowledge.json').read_text())
        self.catalog = json.loads((root / 'content/catalog.json').read_text())

    def test_public_whitelist_and_catalog_links(self):
        build.validate_knowledge(self.cards, self.catalog)
        self.cards['cards'][0]['source_path'] = 'private'
        with self.assertRaisesRegex(ValueError, '私有回源'):
            build.validate_knowledge(self.cards, self.catalog)

    def test_duplicate_and_unknown_chapter_rejected(self):
        self.cards['cards'].append(copy.deepcopy(self.cards['cards'][0]))
        with self.assertRaisesRegex(ValueError, '唯一'):
            build.validate_knowledge(self.cards, self.catalog)
        self.cards['cards'].pop()
        self.cards['cards'][0]['chapters'] = ['UNPUBLISHED-UNKNOWN']
        with self.assertRaisesRegex(ValueError, '目录不存在'):
            build.validate_knowledge(self.cards, self.catalog)

    def test_section_links_do_not_depend_on_title_or_order(self):
        from knowledge import section_anchor
        self.assertEqual(section_anchor('必修第二册-7.3 原标题'),
                         section_anchor('必修第二册-7.3 新标题'))
        self.assertNotEqual(section_anchor('必修第二册-7.2 新标题'),
                            section_anchor('必修第二册-7.3 新标题'))


if __name__ == '__main__':
    unittest.main()
