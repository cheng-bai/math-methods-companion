"""Regression gates for the reviewed public card/exercise mapping."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from example_links import validate
from publications import load as load_publications

ROOT = Path(__file__).resolve().parents[1]
load = lambda name: json.loads((ROOT / 'content' / name).read_text())


class ExampleLinks(unittest.TestCase):
    def setUp(self):
        self.links = load('example-links.json')
        self.knowledge = load('knowledge.json')
        self.publications = load_publications(ROOT / 'content')

    def test_reviewed_mapping(self):
        validate(self.links, self.knowledge, self.publications)
        self.assertEqual({(r['card_id'], r['question_id']) for r in self.links if r['chapter_id'] == 'DEMO-01'},
                         {('k-3b22fa72', f'Q0{i}') for i in range(1, 6)} |
                         {('k-2889c7de', q) for q in ('Q01', 'Q03', 'Q04', 'Q05')})

    def test_partial_links_preserve_key_boundaries(self):
        cards = {card['title']: card['id'] for card in self.knowledge['cards']}
        lookup = {(row['card_id'], row['chapter_id'], row['question_id']): row['focus']
                  for row in self.links}
        equal = lookup[cards['等比数列及其通项公式'], 'DEMO-06', 'Q202']
        self.assertIn('−1/2', equal)
        self.assertIn('零数列', equal)
        for qid in ('Q901', 'Q902'):
            self.assertIn('不直接套无条件', lookup[cards['不放回抽取与恰好计数'], 'DEMO-09', qid])
        self.assertIn((cards['全概率公式'], 'DEMO-09', 'Q903'), lookup)
        self.assertNotIn((cards['全概率公式'], 'DEMO-09', 'Q904'), lookup)
        self.assertIn((cards['三垂线定理'], 'DEMO-07', 'Q704'), lookup)
        self.assertNotIn((cards['三垂线定理'], 'DEMO-07', 'Q703'), lookup)
        self.assertIn('不代表完整轨迹题', lookup[cards['求轨迹的方程'], 'DEMO-08', 'Q804'])

    def test_reject_invalid_inputs(self):
        variants = [None, {}, [None], self.links + [self.links[0]]]
        for field, value in [('card_id', 'unknown'), ('chapter_id', 'DEMO-99'), ('chapter_id', 'DEMO-02'), ('question_id', 'Q999'),
                             ('focus', ''), ('focus', None), ('focus', []),
                             ('private_path', '/private/source'), ('url', 'https://example.com')]:
            rows = copy.deepcopy(self.links)
            rows[0][field] = value
            variants.append(rows)
        for rows in variants:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                validate(rows, self.knowledge, self.publications)

    def test_empty_links_allowed(self):
        validate([], self.knowledge, self.publications)


if __name__ == '__main__':
    unittest.main()
