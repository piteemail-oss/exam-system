from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

sqlite_file_name = Path(__file__).resolve().parents[1] / "exam.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
