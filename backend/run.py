import uvicorn
import os

if __name__ == "__main__":
    # Determine PORT from environment or fallback to 3002
    port = int(os.getenv("PORT", 3002))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
