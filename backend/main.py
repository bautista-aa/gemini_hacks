from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import fitz
import json
from openai import OpenAI

app = FastAPI(title="PaperGraph AI Backend")
openai_client = OpenAI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class GraphNode(BaseModel):
    id: str
    type: str

class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str
    explanation: str
    evidence: str

class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class AskRequest(BaseModel):
    source: str
    target: str
    relation: str
    explanation: str
    evidence: str
    question: str

class AskResponse(BaseModel):
    answer: str

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = [page.get_text() for page in document]
    document.close()
    return "\n\n".join(pages)

async def extract_text_from_files(files: List[UploadFile]) -> str:
    texts: List[str] = []
    for file in files:
        contents = await file.read()
        texts.append(extract_text_from_pdf_bytes(contents))
    return "\n\n".join(texts)


def build_graph_extraction_prompt(paper_text: str) -> str:
    return (
        "You are an assistant that extracts a concise knowledge graph from research paper text. "
        "Return only valid JSON using this schema:\n"
        "{\n  \"nodes\": [ { \"id\": \"...\", \"type\": \"technology|method|application|author\" } ],\n"
        "  \"edges\": [ { \"source\": \"...\", \"target\": \"...\", \"relation\": \"...\", "
        "\"explanation\": \"...\", \"evidence\": \"...\" } ]\n}\n"
        "Use types only from: technology, method, application, author."
        "Include at least one edge per relationship. If no relationships exist, return empty arrays."
        "For each evidence field, include a short quote or citation from the paper text.\n"
        "Paper text:\n" + paper_text
    )


def extract_json_string(text: str) -> str:
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        return text[first:last+1]
    return text


def extract_text_from_response(response) -> str:
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text
    if hasattr(response, "output"):
        pieces = []
        for item in response.output:
            if isinstance(item, dict) and "content" in item:
                for content in item["content"]:
                    if isinstance(content, dict) and content.get("type") == "output_text":
                        pieces.append(content.get("text", ""))
        if pieces:
            return "".join(pieces)
    raise ValueError("Unable to extract text from Gemini response")


def parse_graph_data_from_text(json_text: str) -> GraphData:
    json_text = extract_json_string(json_text)
    data = json.loads(json_text)
    return GraphData.parse_obj(data)


def call_gemini_extract_graph(paper_text: str) -> GraphData:
    prompt = build_graph_extraction_prompt(paper_text)
    # Gemini 3 Flash extraction: convert raw paper text into structured nodes + edges JSON
    response = openai_client.responses.create(
        model="gemini-3-flash",
        input=prompt,
        temperature=0.0,
        top_p=1,
        max_output_tokens=800,
    )
    response_text = extract_text_from_response(response)
    return parse_graph_data_from_text(response_text)

mock_graph = GraphData(
    nodes=[
        GraphNode(id="Edge AI", type="technology"),
        GraphNode(id="Glucose Monitoring", type="application"),
    ],
    edges=[
        GraphEdge(
            source="Edge AI",
            target="Glucose Monitoring",
            relation="enables",
            explanation="Edge AI enables real-time glucose monitoring by processing sensor data locally.",
            evidence="A research paper shows Edge AI can analyze glucose sensor outputs with low latency."
        )
    ],
)

current_graph: GraphData = mock_graph

@app.post("/upload", response_model=GraphData)
async def upload_papers(files: List[UploadFile] = File(...)):
    global current_graph
    raw_text = await extract_text_from_files(files)
    print(f"Extracted text from {len(files)} PDF(s), total length={len(raw_text)} characters")
    try:
        graph_data = call_gemini_extract_graph(raw_text)
        current_graph = graph_data
        return graph_data
    except Exception as exc:
        print(f"Gemini extraction failed: {exc}")
        current_graph = mock_graph
        return mock_graph

@app.get("/graph", response_model=GraphData)
def get_graph():
    return current_graph

def build_live_ask_prompt(request: AskRequest) -> str:
    return (
        "You are a helpful research assistant for academic research knowledge graphs. "
        "Use only the provided connection data and evidence to answer the user question clearly. "
        "Do not invent new relationships. Keep the answer concise and grounded.\n\n"
        "Connection:\n"
        f"Source: {request.source}\n"
        f"Target: {request.target}\n"
        f"Relation: {request.relation}\n"
        f"Explanation: {request.explanation}\n"
        f"Evidence: {request.evidence}\n\n"
        f"User question: {request.question}\n"
        "Answer:")

@app.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest):
    # Gemini 3 Flash live interaction: answer the user question using the selected connection context
    prompt = build_live_ask_prompt(request)
    response = openai_client.responses.create(
        model="gemini-3-flash",
        input=prompt,
        temperature=0.0,
        top_p=1,
        max_output_tokens=300,
    )
    answer_text = extract_text_from_response(response).strip()
    return AskResponse(answer=answer_text)
