from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import create_engine, Column, String, Integer, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, HttpUrl
import string, random, os
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/urlshortener")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="URL Shortener API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class URL(Base):
    __tablename__ = "urls"
    id = Column(Integer, primary_key=True, index=True)
    original_url = Column(String, nullable=False)
    short_code = Column(String(10), unique=True, index=True, nullable=False)
    clicks = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# --- Schemas ---
class URLCreate(BaseModel):
    url: str
    custom_code: str | None = None

class URLResponse(BaseModel):
    original_url: str
    short_code: str
    short_url: str
    clicks: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Helpers ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_code(length=6):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# --- Routes ---
@app.post("/shorten", response_model=URLResponse)
def shorten_url(payload: URLCreate, db: Session = Depends(get_db)):
    code = payload.custom_code or generate_code()

    # Validate custom code uniqueness
    if db.query(URL).filter(URL.short_code == code).first():
        raise HTTPException(status_code=409, detail="Short code already in use.")

    url_obj = URL(original_url=payload.url, short_code=code)
    db.add(url_obj)
    db.commit()
    db.refresh(url_obj)

    return URLResponse(
        original_url=url_obj.original_url,
        short_code=url_obj.short_code,
        short_url=f"{BASE_URL}/{url_obj.short_code}",
        clicks=url_obj.clicks,
        created_at=url_obj.created_at,
    )

@app.get("/urls", response_model=list[URLResponse])
def list_urls(db: Session = Depends(get_db)):
    urls = db.query(URL).order_by(URL.created_at.desc()).limit(20).all()
    return [
        URLResponse(
            original_url=u.original_url,
            short_code=u.short_code,
            short_url=f"{BASE_URL}/{u.short_code}",
            clicks=u.clicks,
            created_at=u.created_at,
        ) for u in urls
    ]

@app.get("/{short_code}")
def redirect_url(short_code: str, db: Session = Depends(get_db)):
    url_obj = db.query(URL).filter(URL.short_code == short_code).first()
    if not url_obj:
        raise HTTPException(status_code=404, detail="URL not found.")
    url_obj.clicks += 1
    db.commit()
    return RedirectResponse(url=url_obj.original_url)

@app.delete("/urls/{short_code}")
def delete_url(short_code: str, db: Session = Depends(get_db)):
    url_obj = db.query(URL).filter(URL.short_code == short_code).first()
    if not url_obj:
        raise HTTPException(status_code=404, detail="URL not found.")
    db.delete(url_obj)
    db.commit()
    return {"message": "Deleted successfully."}

@app.get("/health")
def health():
    return {"status": "ok"}