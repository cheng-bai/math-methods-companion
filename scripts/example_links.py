"""Explicit, reviewed links; never infer exercise coverage from keywords."""


def validate(links, knowledge, publications):
    if not isinstance(links, list):
        raise ValueError('例训关联必须是列表')
    cards = {c['id'] for c in knowledge['cards']}
    questions = {(chapter['id'], q['id']) for chapter in publications for q in chapter['questions']}
    pairs = set()
    for row in links:
        if not isinstance(row, dict) or set(row) != {'card_id', 'chapter_id', 'question_id', 'focus'}:
            raise ValueError('例训关联仅允许卡ID、讲ID、题ID和对应动作')
        if any(not isinstance(value, str) or not value.strip() for value in row.values()):
            raise ValueError('例训关联字段必须为非空文本')
        if row['card_id'] not in cards or (row['chapter_id'], row['question_id']) not in questions:
            raise ValueError('例训关联指向不存在的卡或题')
        pair = row['card_id'], row['chapter_id'], row['question_id']
        if pair in pairs:
            raise ValueError('重复的卡题关联')
        pairs.add(pair)
