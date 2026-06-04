from sqlmodel import Field, SQLModel
from datetime import datetime
from typing import Optional

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    create_time: datetime = Field(default_factory=datetime.now)

class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(index=True, foreign_key="category.id")
    type: int = Field(index=True) # 1:单选, 2:多选, 3:判断
    content: str
    options: str # JSON string
    correct_answer: str
    analysis: Optional[str] = None
    create_time: datetime = Field(default_factory=datetime.now)

class WrongQuestion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(unique=True, index=True, foreign_key="question.id")
    user_answer: Optional[str] = None
    wrong_count: int = Field(default=1, index=True)
    update_time: datetime = Field(default_factory=datetime.now)

class ExamRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(index=True, foreign_key="category.id")
    is_wrong_mode: int = Field(index=True) # 0:常规,1:错题
    score: float
    total: int
    answers: str # JSON string
    create_time: datetime = Field(default_factory=datetime.now)
