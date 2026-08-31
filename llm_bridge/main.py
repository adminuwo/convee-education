"""
LLM Bridge - Internal Python microservice that proxies to:
1. Google Cloud Vertex AI (Gemini 2.5 Flash in region asia-south1) using Application Default Credentials (ADC)
2. OpenAI API (gpt-4o-mini for faculty/admin)
Listens on localhost:8002.
"""

import os
import asyncio
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm_bridge")

# Load env from the main backend .env (support local and container paths)
backend_env = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
if os.path.exists(backend_env):
    load_dotenv(backend_env)
else:
    load_dotenv('/app/backend/.env')

app = FastAPI(title="Convee LLM Bridge (Vertex AI + OpenAI)", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001", "http://127.0.0.1:8001", "*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
VERTEX_PROJECT_ID = os.environ.get('VERTEX_PROJECT_ID') or os.environ.get('GOOGLE_CLOUD_PROJECT') or 'ai-mall-484810'
VERTEX_LOCATION = os.environ.get('VERTEX_LOCATION') or 'asia-south1'
VERTEX_GEMINI_MODEL = os.environ.get('VERTEX_GEMINI_MODEL') or 'gemini-2.5-flash'


class ChatRequest(BaseModel):
    session_key: str
    system_message: str = "You are a helpful education assistant."
    user_message: str
    provider: str = 'vertexai'
    model: Optional[str] = None


class ChatResponse(BaseModel):
    text: str
    session_key: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


def estimate_token_count(text: str) -> int:
    """Fallback tokenizer estimation (~4 characters per token)."""
    if not text:
        return 0
    return max(1, len(text.strip()) // 4)


@app.get('/llm_bridge/health')
@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'vertex_ai': {
            'project_id': VERTEX_PROJECT_ID,
            'location': VERTEX_LOCATION,
            'default_model': VERTEX_GEMINI_MODEL,
        },
        'openai': {
            'configured': bool(OPENAI_API_KEY),
            'default_model': 'gpt-4o-mini',
        }
    }


async def call_vertexai_gemini(project_id: str, location: str, model: str, system_msg: str, user_msg: str):
    """
    Invokes Gemini on Vertex AI (region asia-south1) using Application Default Credentials (ADC).
    Returns (text, prompt_tokens, completion_tokens, total_tokens).
    """
    model_name = model or VERTEX_GEMINI_MODEL
    logger.info(f"Invoking Vertex AI Gemini: project={project_id}, location={location}, model={model_name}")

    def _sync_vertex_call():
        from google import genai
        from google.genai import types

        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=location
        )

        config = types.GenerateContentConfig(
            system_instruction=system_msg if system_msg else None,
            temperature=0.7,
        )

        response = client.models.generate_content(
            model=model_name,
            contents=user_msg,
            config=config,
        )

        text = response.text or ""
        
        # Extract token usage metadata from Vertex AI if available
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0

        try:
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                prompt_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) or 0
                completion_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) or 0
                total_tokens = getattr(response.usage_metadata, 'total_token_count', 0) or 0
        except Exception:
            pass

        if total_tokens == 0:
            prompt_tokens = estimate_token_count(system_msg + ' ' + user_msg)
            completion_tokens = estimate_token_count(text)
            total_tokens = prompt_tokens + completion_tokens

        return text, prompt_tokens, completion_tokens, total_tokens

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_vertex_call)


async def call_openai_direct(api_key: str, model: str, system_msg: str, user_msg: str):
    """
    Invokes OpenAI API (defaults to gpt-4o-mini).
    Returns (text, prompt_tokens, completion_tokens, total_tokens).
    """
    import json
    import urllib.request

    model_name = "gpt-4o-mini" if (not model or model in ["gpt-5.4", "gpt-4o-mini", "default"]) else model
    logger.info(f"Invoking OpenAI: model={model_name}")

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
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))

    res_data = await loop.run_in_executor(None, _fetch)
    text = res_data['choices'][0]['message']['content'] or ""
    
    usage = res_data.get('usage', {})
    prompt_tokens = usage.get('prompt_tokens') or estimate_token_count(system_msg + ' ' + user_msg)
    completion_tokens = usage.get('completion_tokens') or estimate_token_count(text)
    total_tokens = usage.get('total_tokens') or (prompt_tokens + completion_tokens)

    return text, prompt_tokens, completion_tokens, total_tokens


@app.post('/llm_bridge/chat', response_model=ChatResponse)
@app.post('/chat', response_model=ChatResponse)
async def chat(req: ChatRequest):
    provider = (req.provider or 'vertexai').lower()

    if provider in ['vertexai', 'gemini', 'google']:
        target_model = req.model or VERTEX_GEMINI_MODEL
        try:
            text, p_tok, c_tok, t_tok = await call_vertexai_gemini(
                project_id=VERTEX_PROJECT_ID,
                location=VERTEX_LOCATION,
                model=target_model,
                system_msg=req.system_message,
                user_msg=req.user_message
            )
            return ChatResponse(
                text=text,
                session_key=req.session_key,
                provider='vertexai',
                model=target_model,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                total_tokens=t_tok
            )
        except Exception as e:
            logger.error(f"Vertex AI Gemini generation failed: {e}")
            if OPENAI_API_KEY:
                logger.warning("Falling back to OpenAI due to Vertex AI error...")
                try:
                    text, p_tok, c_tok, t_tok = await call_openai_direct(OPENAI_API_KEY, 'gpt-4o-mini', req.system_message, req.user_message)
                    return ChatResponse(
                        text=text,
                        session_key=req.session_key,
                        provider='openai (fallback)',
                        model='gpt-4o-mini',
                        prompt_tokens=p_tok,
                        completion_tokens=c_tok,
                        total_tokens=t_tok
                    )
                except Exception as fb_err:
                    logger.error(f"Fallback OpenAI error: {fb_err}")
            raise HTTPException(status_code=500, detail=f"Vertex AI Error ({target_model} in {VERTEX_LOCATION}): {str(e)}")

    elif provider in ['openai']:
        if not OPENAI_API_KEY:
            logger.warning("OpenAI API key missing, routing to Vertex AI Gemini...")
            try:
                text, p_tok, c_tok, t_tok = await call_vertexai_gemini(
                    project_id=VERTEX_PROJECT_ID,
                    location=VERTEX_LOCATION,
                    model=VERTEX_GEMINI_MODEL,
                    system_msg=req.system_message,
                    user_msg=req.user_message
                )
                return ChatResponse(
                    text=text,
                    session_key=req.session_key,
                    provider='vertexai (fallback)',
                    model=VERTEX_GEMINI_MODEL,
                    prompt_tokens=p_tok,
                    completion_tokens=c_tok,
                    total_tokens=t_tok
                )
            except Exception as v_err:
                raise HTTPException(status_code=503, detail=f"No OpenAI key configured and Vertex AI fallback failed: {str(v_err)}")

        target_model = req.model or 'gpt-4o-mini'
        try:
            text, p_tok, c_tok, t_tok = await call_openai_direct(OPENAI_API_KEY, target_model, req.system_message, req.user_message)
            return ChatResponse(
                text=text,
                session_key=req.session_key,
                provider='openai',
                model=target_model,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                total_tokens=t_tok
            )
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail=f"Unknown LLM provider: {req.provider}. Use 'vertexai' or 'openai'.")



if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('LLM_BRIDGE_PORT', 8002))
    uvicorn.run('main:app', host='0.0.0.0', port=port)
