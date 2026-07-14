"""Seed admin user and sample rooms."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.core.database import Base, engine  # noqa: E402
from app.main import seed_initial_data  # noqa: E402

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    print("Seed complete. Default users:")
    print("  admin@hotel.dev / admin123")
    print("  reception@hotel.dev / reception123")
