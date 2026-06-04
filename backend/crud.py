import csv
import io
from openpyxl import load_workbook
from sqlmodel import Session, select, func
from .models import Category, Question, WrongQuestion, ExamRecord
from .schemas import CategoryCreate, QuestionCreate, ExamSubmit, CategoryRead, QuestionRead, WrongQuestionRead, OptionItem
import json
from typing import List, Optional
from datetime import datetime
import os

def normalize_answer(answer: Optional[str]) -> str:
    if answer is None:
        return ''
    answer = str(answer).strip().upper()
    if not answer:
        return ''
    parts = [item.strip() for item in answer.replace('，', ',').split(',') if item.strip()]
    return ','.join(sorted(parts))

def normalize_header(value: Optional[str]) -> str:
    return value.strip().lower() if value else ""

def read_data_rows(file):
    filename = file.filename.lower()
    if filename.endswith(".csv"):
        content = file.file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))
        return [{normalize_header(k): (v.strip() if v else "") for k, v in row.items()} for row in reader]
    elif filename.endswith(('.xlsx', '.xlsm', '.xltx', '.xltm')):
        workbook = load_workbook(file.file, data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [normalize_header(cell) for cell in rows[0]]
        data_rows = []
        for line in rows[1:]:
            row_dict = {}
            for index, cell in enumerate(line):
                header = headers[index] if index < len(headers) else f"column_{index}"
                row_dict[header] = str(cell).strip() if cell is not None else ""
            data_rows.append(row_dict)
        return data_rows
    else:
        raise ValueError("只支持 CSV 或 XLSX 文件")


def get_or_create_category(session: Session, name: str):
    category = session.exec(select(Category).where(Category.name == name)).first()
    if category:
        return category
    category = Category(name=name)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def parse_import_row(row: dict):
    category_name = row.get('category_name', '') or row.get('category', '')
    category_name = category_name.strip()
    category_id_value = row.get('category_id', '').strip()
    type_value = row.get('type', '').strip()
    content = row.get('content', '').strip()
    correct_answer = row.get('correct_answer', '').strip()
    analysis = row.get('analysis', '').strip()

    if not category_name and not category_id_value:
        raise ValueError('category_name 或 category_id 必填')
    if not type_value:
        raise ValueError('type 必填，1=单选，2=多选，3=判断')

    try:
        question_type = int(float(type_value))
    except ValueError:
        raise ValueError('type 必须为数字，1=单选，2=多选，3=判断')

    if question_type not in (1, 2, 3):
        raise ValueError('type 必须为 1、2 或 3')
    if not content:
        raise ValueError('content 不能为空')
    if not correct_answer:
        raise ValueError('correct_answer 不能为空')

    options = []
    for alias in ['A', 'B', 'C', 'D', 'E', 'F']:
        value = row.get(f'option_{alias.lower()}', '') or row.get(f'option_{alias}', '')
        text = value.strip()
        if text:
            options.append({'alias': alias, 'text': text})

    if question_type == 3:
        if not options:
            options = [
                {'alias': 'A', 'text': '对'},
                {'alias': 'B', 'text': '错'}
            ]
        correct_answer = correct_answer.upper()
    else:
        if len(options) < 2:
            raise ValueError('单选/多选题至少需要两个选项')
        correct_answer = ','.join([item.strip().upper() for item in correct_answer.replace('，', ',').split(',') if item.strip()])

    return {
        'category_name': category_name,
        'category_id_value': category_id_value,
        'type': question_type,
        'content': content,
        'options': options,
        'correct_answer': correct_answer,
        'analysis': analysis or None
    }


def validate_import_row(row: dict, session: Session = None):
    data = parse_import_row(row)
    if data['category_id_value']:
        try:
            category_id = int(float(data['category_id_value']))
        except ValueError:
            raise ValueError('category_id 必须为数字')
        if session:
            category = session.get(Category, category_id)
            if not category:
                raise ValueError('category_id 对应的科目不存在')
    return data


def build_preview_row(row: dict):
    return {
        'row_number': row.get('row_number'),
        'category_name': row.get('category_name', '') or row.get('category', ''),
        'category_id': row.get('category_id', ''),
        'type': row.get('type', ''),
        'content': row.get('content', ''),
        'option_A': row.get('option_a', '') or row.get('option_A', ''),
        'option_B': row.get('option_b', '') or row.get('option_B', ''),
        'option_C': row.get('option_c', '') or row.get('option_C', ''),
        'option_D': row.get('option_d', '') or row.get('option_D', ''),
        'option_E': row.get('option_e', '') or row.get('option_E', ''),
        'option_F': row.get('option_f', '') or row.get('option_F', ''),
        'correct_answer': row.get('correct_answer', ''),
        'analysis': row.get('analysis', ''),
        'valid': False,
        'error': ''
    }


def preview_import_from_file(session: Session, file):
    rows = read_data_rows(file)
    preview_rows = []
    valid_count = 0
    invalid_count = 0
    errors = []

    for index, raw in enumerate(rows, start=2):
        preview_data = build_preview_row({'row_number': index, **raw})
        try:
            validate_import_row(raw, session=session)
            preview_data['valid'] = True
            valid_count += 1
        except Exception as exc:
            preview_data['valid'] = False
            preview_data['error'] = str(exc)
            invalid_count += 1
            errors.append({'row': index, 'message': str(exc)})
        preview_rows.append(preview_data)

    return {
        'preview_rows': preview_rows,
        'valid_count': valid_count,
        'invalid_count': invalid_count,
        'errors': errors
    }


def import_questions_from_file(session: Session, file):
    rows = read_data_rows(file)
    success_count = 0
    errors = []

    for index, raw in enumerate(rows, start=2):
        try:
            data = parse_import_row(raw)
            category = None
            if data['category_id_value']:
                try:
                    category_id = int(float(data['category_id_value']))
                    category = session.get(Category, category_id)
                except Exception:
                    category = None
            if not category:
                category = get_or_create_category(session, data['category_name'])

            question_data = QuestionCreate(
                category_id=category.id,
                type=data['type'],
                content=data['content'],
                options=[OptionItem(alias=item['alias'], text=item['text']) for item in data['options']],
                correct_answer=data['correct_answer'],
                analysis=data['analysis']
            )
            create_question(session, question_data)
            success_count += 1
        except Exception as exc:
            errors.append({'row': index, 'message': str(exc)})

    return {
        'success_count': success_count,
        'fail_count': len(errors),
        'errors': errors
    }

# Category CRUD
def create_category(session: Session, category: CategoryCreate):
    db_category = Category.model_validate(category)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return CategoryRead(
        id=db_category.id,
        name=db_category.name,
        create_time=db_category.create_time,
        question_count=0,
        correct_rate=0.0
    )

def get_categories(session: Session):
    categories = session.exec(select(Category)).all()
    result = []
    for cat in categories:
        # 总题数
        total_q = session.exec(select(func.count(Question.id)).where(Question.category_id == cat.id)).one() or 0
        
        # 统计最近一次“开始刷题”交卷后的正确率
        latest_normal_record = session.exec(
            select(ExamRecord)
            .where(ExamRecord.category_id == cat.id)
            .where(ExamRecord.is_wrong_mode == 0)
            .order_by(ExamRecord.create_time.desc())
            .limit(1)
        ).first()

        correct_rate = 0.0
        if latest_normal_record:
            correct_rate = latest_normal_record.score or 0.0
        wrong_count = session.exec(
            select(func.count(WrongQuestion.id)).where(
                WrongQuestion.question_id.in_(
                    select(Question.id).where(Question.category_id == cat.id)
                )
            )
        ).one() or 0
        
        cat_read = CategoryRead(
            id=cat.id,
            name=cat.name,
            create_time=cat.create_time,
            question_count=total_q,
            correct_rate=round(correct_rate, 2),
            wrong_count=wrong_count
        )
        result.append(cat_read)
    return result

def get_category_by_id(session: Session, category_id: int):
    return session.get(Category, category_id)

def delete_category(session: Session, category_id: int):
    # 删除科目及关联的所有数据
    # 删除题目和对应的错题
    questions = session.exec(select(Question).where(Question.category_id == category_id)).all()
    for q in questions:
        wrong_q = session.exec(select(WrongQuestion).where(WrongQuestion.question_id == q.id)).first()
        if wrong_q:
            session.delete(wrong_q)
        session.delete(q)
    
    # 删除考试记录
    records = session.exec(select(ExamRecord).where(ExamRecord.category_id == category_id)).all()
    for r in records:
        session.delete(r)
    
    # 删除科目
    cat = session.get(Category, category_id)
    if cat:
        session.delete(cat)
    
    session.commit()
    return True

# Question CRUD
def create_question(session: Session, question: QuestionCreate):
    options_json = json.dumps([o.model_dump() for o in question.options])
    db_question = Question(
        category_id=question.category_id,
        type=question.type,
        content=question.content,
        options=options_json,
        correct_answer=question.correct_answer,
        analysis=question.analysis
    )
    session.add(db_question)
    session.commit()
    session.refresh(db_question)
    
    return QuestionRead(
        id=db_question.id,
        category_id=db_question.category_id,
        type=db_question.type,
        content=db_question.content,
        options=json.loads(db_question.options),
        correct_answer=db_question.correct_answer,
        analysis=db_question.analysis,
        create_time=db_question.create_time
    )

def get_questions_by_category(session: Session, category_id: int, random: bool = False, limit: Optional[int] = None):
    query = select(Question).where(Question.category_id == category_id)
    if random:
        query = query.order_by(func.random())
    if limit:
        query = query.limit(limit)
    
    questions = session.exec(query).all()
    result = []
    for q in questions:
        result.append(QuestionRead(
            id=q.id,
            category_id=q.category_id,
            type=q.type,
            content=q.content,
            options=json.loads(q.options),
            correct_answer=q.correct_answer,
            analysis=q.analysis,
            create_time=q.create_time
        ))
    return result

# Wrong Question CRUD
def get_wrong_questions(session: Session, category_id: Optional[int] = None, random: bool = False, limit: Optional[int] = None):
    query = select(WrongQuestion)
    if category_id:
        query = query.join(Question).where(Question.category_id == category_id)
    
    if random:
        # 按错误次数加权随机，错误次数越高越容易被选中
        query = query.order_by(func.random() * WrongQuestion.wrong_count.desc())
    else:
        query = query.order_by(WrongQuestion.wrong_count.desc())
    
    if limit:
        query = query.limit(limit)
    
    wrong_questions = session.exec(query).all()
    result = []
    for wq in wrong_questions:
        q = session.get(Question, wq.question_id)
        if q:
            q_read = QuestionRead(
                id=q.id,
                category_id=q.category_id,
                type=q.type,
                content=q.content,
                options=json.loads(q.options),
                correct_answer=q.correct_answer,
                analysis=q.analysis,
                create_time=q.create_time
            )
            result.append(WrongQuestionRead(
                id=wq.id,
                question=q_read,
                user_answer=wq.user_answer,
                wrong_count=wq.wrong_count,
                update_time=wq.update_time
            ))
    return result

def update_wrong_question(session: Session, question_id: int, user_answer: str):
    if not user_answer or not str(user_answer).strip():
        return None
    wrong_q = session.exec(select(WrongQuestion).where(WrongQuestion.question_id == question_id)).first()
    if wrong_q:
        wrong_q.wrong_count += 1
        wrong_q.user_answer = user_answer
        wrong_q.update_time = datetime.now()
    else:
        wrong_q = WrongQuestion(
            question_id=question_id,
            user_answer=user_answer,
            wrong_count=1
        )
        session.add(wrong_q)
    session.commit()
    session.refresh(wrong_q)
    return wrong_q

def cut_wrong_question(session: Session, wrong_question_id: int):
    wrong_q = session.get(WrongQuestion, wrong_question_id)
    if wrong_q:
        session.delete(wrong_q)
        session.commit()
        return True
    return False

def cut_wrong_question_by_question_id(session: Session, question_id: int):
    wrong_q = session.exec(select(WrongQuestion).where(WrongQuestion.question_id == question_id)).first()
    if wrong_q:
        session.delete(wrong_q)
        session.commit()
        return True
    return False

# Exam CRUD
def submit_exam(session: Session, exam_data: ExamSubmit):
    debug = os.environ.get('DEBUG_EXAM_SUBMIT') == '1'
    if debug:
        print(f"[submit_exam] category_id={exam_data.category_id} is_wrong_mode={exam_data.is_wrong_mode} total_answers={len(exam_data.answers)}")

    attempted_answers = [ans for ans in exam_data.answers if ans.user_answer and str(ans.user_answer).strip()]
    total = len(attempted_answers)
    correct = 0

    for ans in attempted_answers:
        if debug:
            print(f"[submit_exam] answer incoming question_id={ans.question_id} user_answer={repr(ans.user_answer)} normalized={normalize_answer(ans.user_answer)}")
        q = session.get(Question, ans.question_id)
        if not q:
            if debug:
                print(f"[submit_exam] question not found question_id={ans.question_id}")
            continue
        normalized_correct = normalize_answer(q.correct_answer)
        normalized_user = normalize_answer(ans.user_answer)
        if debug:
            print(f"[submit_exam] q.correct_answer={repr(q.correct_answer)} normalized_correct={normalized_correct}")
        if normalized_user == normalized_correct:
            correct += 1
            wrong_q = session.exec(select(WrongQuestion).where(WrongQuestion.question_id == ans.question_id)).first()
            if debug:
                print(f"[submit_exam] correct answer, wrong_q_exists={wrong_q is not None}")
            if wrong_q:
                session.delete(wrong_q)
        else:
            if debug:
                print(f"[submit_exam] incorrect answer, updating wrong question")
            update_wrong_question(session, ans.question_id, ans.user_answer)

    score = (correct / total) * 100 if total > 0 else 0
    
    # 保存考试记录
    answers_json = json.dumps([a.model_dump() for a in exam_data.answers])
    record = ExamRecord(
        category_id=exam_data.category_id,
        is_wrong_mode=exam_data.is_wrong_mode,
        score=score,
        total=total,
        answers=answers_json
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    
    return {
        "score": score,
        "total": total,
        "correct": correct,
        "record_id": record.id
    }
