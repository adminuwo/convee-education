"""
LLM Bridge - Internal Python microservice that proxies to emergentintegrations library.
Only listens on localhost:8002. The Node.js backend calls this internally.
"""
import os
import asyncio
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Load env from the main backend .env (support local and container paths)
backend_env = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
if os.path.exists(backend_env):
    load_dotenv(backend_env)
else:
    load_dotenv('/app/backend/.env')

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_EMERGENT = True
except ImportError:
    LlmChat = None
    UserMessage = None
    HAS_EMERGENT = False

app = FastAPI(title="LLM Bridge", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8001", "http://127.0.0.1:8001"], allow_methods=["*"], allow_headers=["*"])

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '') or os.environ.get('EMERGENT_LLM_KEY', '')


class ChatRequest(BaseModel):
    session_key: str
    system_message: str = "You are a helpful assistant."
    user_message: str
    provider: str = 'openai'
    model: str = 'gpt-4o-mini'


class ChatResponse(BaseModel):
    text: str
    session_key: str


@app.get('/health')
async def health():
    return {'status': 'ok', 'llm_key_configured': bool(OPENAI_API_KEY), 'has_emergent': HAS_EMERGENT}


async def call_openai_direct(api_key: str, model: str, system_msg: str, user_msg: str) -> str:
    import json
    import urllib.request
    
    # Map default model if needed
    model_name = "gpt-4o-mini" if model in ["gpt-5.4", "gpt-4o-mini", "default"] else model

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    
    loop = asyncio.get_event_loop()
    def _fetch():
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
            
    res_data = await loop.run_in_executor(None, _fetch)
    return res_data['choices'][0]['message']['content']


@app.post('/chat', response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail='No LLM API key configured (set OPENAI_API_KEY or EMERGENT_LLM_KEY in backend/.env)')

    # Priority 1: Use Emergent integrations if installed and key isn't standard sk-
    if HAS_EMERGENT and LlmChat and not OPENAI_API_KEY.startswith("sk-"):
        try:
            chat_instance = LlmChat(
                api_key=OPENAI_API_KEY,
                session_id=req.session_key,
                system_message=req.system_message,
            ).with_model(req.provider, req.model)
            user_msg = UserMessage(text=req.user_message)
            response = await chat_instance.send_message(user_msg)
            if hasattr(response, 'text'):
                text = response.text
            elif isinstance(response, str):
                text = response
            else:
                text = str(response)
            return ChatResponse(text=text, session_key=req.session_key)
        except Exception:
            pass # Fallback to direct OpenAI if emergent fails

    # Priority 2: Direct OpenAI API call for standard OpenAI ChatGPT keys (sk-...)
    try:
        text = await call_openai_direct(OPENAI_API_KEY, req.model, req.system_message, req.user_message)
        return ChatResponse(text=text, session_key=req.session_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'OpenAI API error: {str(e)}')



if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8002)
