from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from openai import OpenAI
from pathlib import Path
import json
import os
import re
import asyncio
import httpx
import zipfile
import io
import base64
import difflib

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Cerebras client
client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key="csk-6r93n96w9v2e6rnxp63x4rwmxdn8r9vkdmtej94nj62wk6wr"
)

# In-memory project storage
project_files = {}

# ============= FILE TOOLS =============
file_tools = [
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create a new file with content. Always provide the COMPLETE file content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path like 'index.html' or 'src/app.js'"},
                    "content": {"type": "string", "description": "Complete file content"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Edit an existing file by finding and replacing text. You MUST read the file first with read_file to know the exact content. The 'find' text must match EXACTLY what is in the file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to file to edit"},
                    "find": {"type": "string", "description": "EXACT text to find in the file (copy from read_file output)"},
                    "replace": {"type": "string", "description": "Text to replace it with"}
                },
                "required": ["path", "find", "replace"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "rewrite_file",
            "description": "Completely rewrite a file with new content. Use this for major changes or when edit_file fails. This replaces the ENTIRE file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to file to rewrite"},
                    "content": {"type": "string", "description": "New complete file content"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the content of a file. ALWAYS call this before edit_file to see the exact current content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to file to read"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Delete a file from the project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to file to delete"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List all files in the project.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_in_files",
            "description": "Search for text across all project files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Text to search for"},
                    "case_sensitive": {"type": "boolean", "description": "Case sensitive search", "default": False}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "batch_create_files",
            "description": "Create multiple files at once. Best for initial project setup. Each file must have complete content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "files": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "path": {"type": "string"},
                                "content": {"type": "string"}
                            },
                            "required": ["path", "content"]
                        }
                    }
                },
                "required": ["files"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "rename_file",
            "description": "Rename or move a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "old_path": {"type": "string", "description": "Current file path"},
                    "new_path": {"type": "string", "description": "New file path"}
                },
                "required": ["old_path", "new_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_structure",
            "description": "Get a tree view of the project structure with file sizes.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

# ============= SUPABASE TOOLS =============
supabase_tools = [
    {
        "type": "function",
        "function": {
            "name": "supabase_sql",
            "description": "Execute raw SQL on Supabase database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "SQL statement to execute"}
                },
                "required": ["sql"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_create_table",
            "description": "Create a table with columns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table_name": {"type": "string"},
                    "columns": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "type": {"type": "string"},
                                "primary_key": {"type": "boolean"},
                                "nullable": {"type": "boolean"},
                                "default": {"type": "string"},
                                "unique": {"type": "boolean"},
                                "references": {"type": "string"}
                            },
                            "required": ["name", "type"]
                        }
                    },
                    "enable_rls": {"type": "boolean", "default": True}
                },
                "required": ["table_name", "columns"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_insert",
            "description": "Insert data into a table.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table": {"type": "string"},
                    "data": {"type": "object"}
                },
                "required": ["table", "data"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_select",
            "description": "Query data from a table.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table": {"type": "string"},
                    "columns": {"type": "string", "default": "*"},
                    "filters": {"type": "object"},
                    "limit": {"type": "integer"}
                },
                "required": ["table"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_update",
            "description": "Update data in a table.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table": {"type": "string"},
                    "data": {"type": "object"},
                    "match": {"type": "object"}
                },
                "required": ["table", "data", "match"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_delete",
            "description": "Delete data from a table.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table": {"type": "string"},
                    "match": {"type": "object"}
                },
                "required": ["table", "match"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_list_tables",
            "description": "List all tables in the database.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "supabase_create_policy",
            "description": "Create Row Level Security policy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table_name": {"type": "string"},
                    "policy_name": {"type": "string"},
                    "operation": {"type": "string", "enum": ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"]},
                    "using_expression": {"type": "string"},
                    "with_check": {"type": "string"}
                },
                "required": ["table_name", "policy_name", "operation", "using_expression"]
            }
        }
    }
]


def execute_tool(tool_name, arguments, project_id, supabase_config=None):
    """Execute a tool and return the result"""
    global project_files

    if project_id not in project_files:
        project_files[project_id] = {}

    files = project_files[project_id]

    # File operations
    if tool_name == "create_file":
        path = arguments.get("path", "")
        content = arguments.get("content", "")
        files[path] = content
        return {"success": True, "path": path, "content": content, "message": f"Created {path} ({len(content)} bytes)"}

    elif tool_name == "edit_file":
        path = arguments.get("path", "")
        find_text = arguments.get("find", "")
        replace_text = arguments.get("replace", "")

        if path not in files:
            return {"success": False, "error": f"File not found: {path}. Available files: {list(files.keys())}"}

        original = files[path]

        # Try exact match first
        if find_text in original:
            new_content = original.replace(find_text, replace_text, 1)
            files[path] = new_content
            return {"success": True, "path": path, "content": new_content, "message": f"Edited {path}"}

        # Try trimmed whitespace match
        find_trimmed = find_text.strip()
        if find_trimmed and find_trimmed in original:
            new_content = original.replace(find_trimmed, replace_text.strip(), 1)
            files[path] = new_content
            return {"success": True, "path": path, "content": new_content, "message": f"Edited {path} (whitespace-adjusted match)"}

        # Try normalized whitespace match
        def normalize_ws(s):
            return re.sub(r'\s+', ' ', s.strip())

        norm_find = normalize_ws(find_text)
        lines = original.split('\n')
        # Try to find a window of lines that matches when normalized
        find_lines = find_text.strip().split('\n')
        window_size = len(find_lines)

        for i in range(len(lines) - window_size + 1):
            window = '\n'.join(lines[i:i + window_size])
            if normalize_ws(window) == norm_find:
                new_content = original.replace(window, replace_text, 1)
                files[path] = new_content
                return {"success": True, "path": path, "content": new_content, "message": f"Edited {path} (fuzzy match)"}

        # Show helpful context
        close_matches = difflib.get_close_matches(find_text[:100], [l for l in lines if l.strip()], n=3, cutoff=0.4)
        hint = ""
        if close_matches:
            hint = f" Similar lines found: {close_matches}"

        return {
            "success": False,
            "error": f"Text not found in {path}.{hint} Use read_file to see the exact current content, then try again with the exact text. Or use rewrite_file to replace the entire file.",
            "file_preview": original[:2000] if len(original) > 2000 else original
        }

    elif tool_name == "rewrite_file":
        path = arguments.get("path", "")
        content = arguments.get("content", "")
        files[path] = content
        return {"success": True, "path": path, "content": content, "message": f"Rewrote {path} ({len(content)} bytes)"}

    elif tool_name == "read_file":
        path = arguments.get("path", "")
        if path in files:
            return {"success": True, "path": path, "content": files[path]}
        return {"success": False, "error": f"File not found: {path}. Available files: {list(files.keys())}"}

    elif tool_name == "delete_file":
        path = arguments.get("path", "")
        if path in files:
            del files[path]
            return {"success": True, "path": path, "message": f"Deleted {path}"}
        return {"success": False, "error": f"File not found: {path}"}

    elif tool_name == "rename_file":
        old_path = arguments.get("old_path", "")
        new_path = arguments.get("new_path", "")
        if old_path in files:
            files[new_path] = files[old_path]
            del files[old_path]
            return {"success": True, "old_path": old_path, "new_path": new_path, "content": files[new_path]}
        return {"success": False, "error": f"File not found: {old_path}"}

    elif tool_name == "list_files":
        file_list = []
        for path, content in files.items():
            file_list.append({"path": path, "size": len(content)})
        return {"success": True, "files": file_list}

    elif tool_name == "search_in_files":
        query = arguments.get("query", "")
        case_sensitive = arguments.get("case_sensitive", False)
        results = []

        for path, content in files.items():
            search_content = content if case_sensitive else content.lower()
            search_query = query if case_sensitive else query.lower()

            if search_query in search_content:
                file_lines = content.split('\n')
                for i, line in enumerate(file_lines):
                    check_line = line if case_sensitive else line.lower()
                    if search_query in check_line:
                        results.append({
                            "file": path,
                            "line": i + 1,
                            "content": line.strip()[:100]
                        })

        return {"success": True, "matches": results, "count": len(results)}

    elif tool_name == "batch_create_files":
        created = []
        all_files = {}
        for file_info in arguments.get("files", []):
            path = file_info.get("path", "")
            content = file_info.get("content", "")
            files[path] = content
            created.append(path)
            all_files[path] = content
        return {"success": True, "created": created, "count": len(created), "files": all_files}

    elif tool_name == "get_file_structure":
        structure = []
        for path, content in files.items():
            structure.append({
                "path": path,
                "size": len(content),
                "lines": content.count('\n') + 1
            })
        return {"success": True, "files": structure}

    # Supabase operations
    elif tool_name.startswith("supabase_"):
        return asyncio.run(execute_supabase_tool(tool_name, arguments, supabase_config))

    return {"success": False, "error": f"Unknown tool: {tool_name}"}


async def execute_supabase_tool(tool_name, arguments, supabase_config):
    """Execute Supabase operations"""
    if not supabase_config or not supabase_config.get("url"):
        return {"success": False, "error": "Supabase not configured"}

    url = supabase_config["url"].rstrip('/')
    service_key = supabase_config.get("serviceKey") or supabase_config.get("key", "")

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        try:
            if tool_name == "supabase_sql":
                sql = arguments.get("sql", "")
                response = await http_client.post(
                    f"{url}/rest/v1/rpc/exec_sql",
                    headers=headers,
                    json={"query": sql}
                )
                if response.status_code == 404:
                    response = await http_client.post(
                        f"{url}/rest/v1/",
                        headers={**headers, "Prefer": "return=representation"},
                        content=sql
                    )
                return {"success": response.status_code < 400, "result": response.text}

            elif tool_name == "supabase_create_table":
                table = arguments.get("table_name", "")
                columns = arguments.get("columns", [])
                enable_rls = arguments.get("enable_rls", True)

                col_defs = []
                for col in columns:
                    col_def = f'"{col["name"]}" {col["type"]}'
                    if col.get("primary_key"):
                        col_def += " PRIMARY KEY"
                    if col.get("unique"):
                        col_def += " UNIQUE"
                    if not col.get("nullable", True):
                        col_def += " NOT NULL"
                    if col.get("default"):
                        col_def += f' DEFAULT {col["default"]}'
                    if col.get("references"):
                        col_def += f' REFERENCES {col["references"]}'
                    col_defs.append(col_def)

                sql = f'CREATE TABLE IF NOT EXISTS "{table}" ({", ".join(col_defs)});'
                if enable_rls:
                    sql += f' ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;'

                return {"success": True, "sql": sql, "message": f"Table {table} creation SQL ready."}

            elif tool_name == "supabase_insert":
                table = arguments.get("table", "")
                data = arguments.get("data", {})
                response = await http_client.post(
                    f"{url}/rest/v1/{table}",
                    headers={**headers, "Prefer": "return=representation"},
                    json=data
                )
                return {"success": response.status_code < 400, "data": response.json() if response.status_code < 400 else response.text}

            elif tool_name == "supabase_select":
                table = arguments.get("table", "")
                columns = arguments.get("columns", "*")
                limit = arguments.get("limit", 100)

                params = {"select": columns, "limit": limit}
                filters = arguments.get("filters", {})
                for key, value in filters.items():
                    params[key] = f"eq.{value}"

                response = await http_client.get(f"{url}/rest/v1/{table}", headers=headers, params=params)
                return {"success": response.status_code < 400, "data": response.json() if response.status_code < 400 else response.text}

            elif tool_name == "supabase_update":
                table = arguments.get("table", "")
                data = arguments.get("data", {})
                match = arguments.get("match", {})

                params = {}
                for key, value in match.items():
                    params[key] = f"eq.{value}"

                response = await http_client.patch(
                    f"{url}/rest/v1/{table}",
                    headers={**headers, "Prefer": "return=representation"},
                    params=params,
                    json=data
                )
                return {"success": response.status_code < 400, "data": response.json() if response.status_code < 400 else response.text}

            elif tool_name == "supabase_delete":
                table = arguments.get("table", "")
                match = arguments.get("match", {})

                params = {}
                for key, value in match.items():
                    params[key] = f"eq.{value}"

                response = await http_client.delete(f"{url}/rest/v1/{table}", headers=headers, params=params)
                return {"success": response.status_code < 400}

            elif tool_name == "supabase_list_tables":
                return {"success": True, "message": "Use Supabase dashboard to view tables, or query information_schema.tables"}

            elif tool_name == "supabase_create_policy":
                table = arguments.get("table_name", "")
                policy = arguments.get("policy_name", "")
                op = arguments.get("operation", "ALL")
                using = arguments.get("using_expression", "true")
                check = arguments.get("with_check", "")

                sql = f'CREATE POLICY "{policy}" ON "{table}" FOR {op} USING ({using})'
                if check:
                    sql += f' WITH CHECK ({check})'
                sql += ";"

                return {"success": True, "sql": sql, "message": f"Policy SQL ready."}

        except Exception as e:
            return {"success": False, "error": str(e)}

    return {"success": False, "error": "Unknown Supabase operation"}


# ============= SSE HELPER =============
def sse_event(event_type, data):
    """Format a Server-Sent Event"""
    json_data = json.dumps(data) if isinstance(data, (dict, list)) else data
    return f"event: {event_type}\ndata: {json_data}\n\n"


# ============= API ENDPOINTS =============

@app.post("/projects/{project_id}/files/{path:path}")
async def save_file(project_id: str, path: str, request: Request):
    data = await request.json()
    if project_id not in project_files:
        project_files[project_id] = {}
    project_files[project_id][path] = data.get("content", "")
    return {"success": True}


@app.get("/projects/{project_id}/files")
async def get_files(project_id: str):
    return {"files": project_files.get(project_id, {})}


@app.post("/projects/{project_id}/sync")
async def sync_project(project_id: str, request: Request):
    """Sync all files from frontend to backend"""
    data = await request.json()
    project_files[project_id] = data.get("files", {})
    return {"success": True, "count": len(project_files[project_id])}


@app.get("/projects/{project_id}/download")
async def download_project(project_id: str):
    """Download project as ZIP file"""
    files = project_files.get(project_id, {})
    if not files:
        raise HTTPException(status_code=404, detail="No files found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for path, content in files.items():
            zf.writestr(path, content)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={project_id}.zip"}
    )


@app.post("/projects/{project_id}/upload")
async def upload_file(project_id: str, request: Request):
    """Handle file uploads"""
    data = await request.json()
    filename = data.get("filename", "uploaded_file")
    content = data.get("content", "")
    is_base64 = data.get("is_base64", False)

    if project_id not in project_files:
        project_files[project_id] = {}

    if is_base64:
        file_type = data.get("type", "image/png")
        project_files[project_id][filename] = f"data:{file_type};base64,{content}"
    else:
        project_files[project_id][filename] = content

    return {"success": True, "path": filename}


@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    message = data.get("message", "")
    project_id = data.get("project_id", "default")
    history = data.get("history", [])
    mode = data.get("mode", "build")
    model = data.get("model", "llama-3.3-70b")
    supabase_config = data.get("supabase")
    questionnaire = data.get("questionnaire", {})
    uploaded_files = data.get("uploaded_files", [])

    if project_id not in project_files:
        project_files[project_id] = {}

    # Build context
    questionnaire_context = ""
    if questionnaire:
        questionnaire_context = "\n\nProject requirements from questionnaire:\n"
        for key, value in questionnaire.items():
            questionnaire_context += f"- {key}: {value}\n"

    supabase_context = ""
    if supabase_config and supabase_config.get("url"):
        auth_providers = supabase_config.get("authProviders", {})
        enabled_providers = [p for p, v in auth_providers.items() if v]
        auth_info = ""
        if enabled_providers:
            auth_info = f"""
Auth providers enabled: {', '.join(enabled_providers)}
When the user wants login/signup, generate Supabase Auth code using @supabase/supabase-js:
- Import: import {{ createClient }} from 'https://esm.sh/@supabase/supabase-js@2'
- Init: const supabase = createClient('{supabase_config['url']}', 'SUPABASE_ANON_KEY')
- Email signup: supabase.auth.signUp({{ email, password }})
- Email login: supabase.auth.signInWithPassword({{ email, password }})
- Google OAuth: supabase.auth.signInWithOAuth({{ provider: 'google' }})
- GitHub OAuth: supabase.auth.signInWithOAuth({{ provider: 'github' }})
- Magic link: supabase.auth.signInWithOtp({{ email }})
- Logout: supabase.auth.signOut()
- Get user: supabase.auth.getUser()
- Listen for auth changes: supabase.auth.onAuthStateChange((event, session) => {{ ... }})
Create beautiful login/signup forms with the enabled providers. Use modern glassmorphism styling."""
        supabase_context = f"""

SUPABASE IS CONNECTED!
Project URL: {supabase_config['url']}
You can create tables, insert data, query data, and manage the database.{auth_info}"""

    # Current files context with content preview
    current_files = project_files[project_id]
    if current_files:
        files_info = []
        for path, content in current_files.items():
            size = len(content)
            lines = content.count('\n') + 1
            files_info.append(f"  - {path} ({size} bytes, {lines} lines)")
        files_context = "\n\nCurrent project files:\n" + "\n".join(files_info)
    else:
        files_context = "\n\nNo files in the project yet. Create files to get started."

    # Uploaded files context
    upload_context = ""
    if uploaded_files:
        upload_context = f"\n\nUser has uploaded these files: {uploaded_files}"

    # Mode-specific prompts
    if mode == "plan":
        system_prompt = f"""You are an expert software architect and planner.

TASK: Create a detailed implementation plan for the user's request.

Your plan should include:
1. **Overview**: What we're building
2. **Pages/Components**: List each page and its purpose
3. **Features**: Core functionality breakdown
4. **Database Schema**: If using Supabase
5. **File Structure**: What files to create
6. **Implementation Steps**: Ordered list of tasks

Format your response in Markdown with clear sections.
{questionnaire_context}{files_context}"""

    elif mode == "ui_fix":
        system_prompt = f"""You are an expert UI/UX developer specializing in fixing visual issues.

The user will describe a UI problem. Your job is to:
1. FIRST use read_file to see the current file content
2. Identify the issue
3. Fix it using edit_file (for small changes) or rewrite_file (for big changes)

CRITICAL RULES:
- ALWAYS read_file BEFORE edit_file to see exact content
- If edit_file fails, use rewrite_file instead
- Focus on CSS for styling, HTML for structure, JS for behavior
- After fixing, briefly explain what you changed

{files_context}"""

    else:  # build mode
        system_prompt = f"""You are an expert full-stack developer. Build exactly what the user asks for.

CRITICAL RULES - FOLLOW THESE EXACTLY:
1. USE YOUR TOOLS to create and edit files. DO NOT just describe code in text.
2. For NEW projects: Use batch_create_files to create all files at once with COMPLETE content.
3. For EDITING existing files: 
   a. FIRST call read_file to see the exact current content
   b. Then call edit_file with the EXACT text copied from read_file output
   c. If edit_file fails, use rewrite_file to replace the entire file
4. NEVER use edit_file without reading the file first.
5. Always create COMPLETE, WORKING code - no placeholders or "// add more here" comments.
6. Use modern, beautiful designs. Dark themes with gradients, shadows, smooth transitions.
7. Make sure HTML files include proper DOCTYPE, charset, and viewport meta tags.
8. When creating a web project, always create at minimum: index.html, style.css, script.js

WORKFLOW FOR NEW PROJECTS:
1. Use batch_create_files with ALL files and their COMPLETE content
2. This is the most reliable approach - creates everything in one shot

WORKFLOW FOR EDITING:
1. read_file to see current content
2. edit_file with exact match OR rewrite_file for large changes
3. Verify by listing files

IMPORTANT NOTES:
- The user sees a live preview of HTML files. Make sure your HTML is complete and valid.
- CSS and JS files are automatically injected into the preview.
- After you create/edit files, the preview updates automatically.
{questionnaire_context}{supabase_context}{files_context}{upload_context}"""

    async def event_generator():
        try:
            # Build tools list
            available_tools = file_tools.copy()
            if supabase_config and supabase_config.get("url"):
                available_tools.extend(supabase_tools)

            messages = [{"role": "system", "content": system_prompt}]

            # Add history
            for msg in history[-15:]:
                if msg.get("role") in ["user", "assistant"] and msg.get("content"):
                    messages.append({"role": msg["role"], "content": msg["content"][:4000]})

            messages.append({"role": "user", "content": message})

            # Plan mode - no tools, stream text
            if mode == "plan":
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    stream=True,
                    max_tokens=4000
                )

                full_response = ""
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        full_response += text
                        yield sse_event("text", {"content": text})

                yield sse_event("plan", {"content": full_response})
                yield sse_event("done", {"status": "complete"})
                return

            # Build/UI Fix mode - with tools
            max_iterations = 15
            iteration = 0

            while iteration < max_iterations:
                iteration += 1

                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=available_tools,
                    stream=True,
                    max_tokens=8000
                )

                full_response = ""
                tool_calls = []

                for chunk in response:
                    delta = chunk.choices[0].delta

                    if delta.content:
                        full_response += delta.content
                        yield sse_event("text", {"content": delta.content})

                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            if tc.index is not None:
                                while len(tool_calls) <= tc.index:
                                    tool_calls.append({"id": "", "name": "", "arguments": ""})

                                if tc.id:
                                    tool_calls[tc.index]["id"] = tc.id
                                if tc.function:
                                    if tc.function.name:
                                        tool_calls[tc.index]["name"] = tc.function.name
                                    if tc.function.arguments:
                                        tool_calls[tc.index]["arguments"] += tc.function.arguments

                finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

                # No tool calls - done
                if not tool_calls or finish_reason == "stop":
                    break

                # Execute tool calls
                assistant_msg = {"role": "assistant", "content": full_response or None, "tool_calls": [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["arguments"]}}
                    for tc in tool_calls if tc["name"]
                ]}
                messages.append(assistant_msg)

                for tc in tool_calls:
                    if not tc["name"]:
                        continue

                    try:
                        args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                    except json.JSONDecodeError:
                        args = {}

                    result = execute_tool(tc["name"], args, project_id, supabase_config)

                    # Send tool call event to frontend
                    tool_info = {
                        "name": tc["name"],
                        "args": {k: v[:200] if isinstance(v, str) and len(v) > 200 else v for k, v in args.items() if k != "content"},
                        "result": {
                            "success": result.get("success", False),
                            "message": result.get("message", ""),
                            "path": result.get("path", ""),
                            "error": result.get("error", "")
                        }
                    }

                    # Include full file content for file mutations
                    if result.get("success") and result.get("content") is not None:
                        tool_info["result"]["content"] = result["content"]
                        tool_info["result"]["path"] = result.get("path", result.get("new_path", ""))

                    # For batch_create_files, include all created files
                    if tc["name"] == "batch_create_files" and result.get("success"):
                        tool_info["result"]["files"] = result.get("files", {})
                        tool_info["result"]["created"] = result.get("created", [])

                    # For rename_file
                    if tc["name"] == "rename_file" and result.get("success"):
                        tool_info["result"]["old_path"] = result.get("old_path", "")
                        tool_info["result"]["new_path"] = result.get("new_path", "")
                        tool_info["result"]["content"] = result.get("content", "")

                    yield sse_event("tool_call", tool_info)

                    # Send result back to AI (truncate content to avoid token overflow)
                    result_for_ai = {**result}
                    if "content" in result_for_ai and isinstance(result_for_ai["content"], str) and len(result_for_ai["content"]) > 3000:
                        result_for_ai["content"] = result_for_ai["content"][:3000] + f"\n... (truncated, {len(result['content'])} total bytes)"
                    if "files" in result_for_ai:
                        del result_for_ai["files"]  # Don't send all file contents back to AI
                    if "file_preview" in result_for_ai and len(result_for_ai["file_preview"]) > 2000:
                        result_for_ai["file_preview"] = result_for_ai["file_preview"][:2000] + "..."

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result_for_ai)
                    })

                await asyncio.sleep(0.05)

            yield sse_event("done", {"status": "complete"})

        except Exception as e:
            yield sse_event("error", {"message": str(e)})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/search")
async def search(request: Request):
    data = await request.json()
    query = data.get("query", "")

    async def search_stream():
        response = client.chat.completions.create(
            model="llama-3.3-70b",
            messages=[
                {"role": "system", "content": "You are a helpful search assistant. Answer concisely."},
                {"role": "user", "content": query}
            ],
            stream=True
        )

        for chunk in response:
            if chunk.choices[0].delta.content:
                yield sse_event("text", {"content": chunk.choices[0].delta.content})

        yield sse_event("done", {"status": "complete"})

    return StreamingResponse(search_stream(), media_type="text/event-stream")


@app.post("/supabase/test")
async def test_supabase(request: Request):
    data = await request.json()
    url = data.get("url", "").rstrip('/')
    key = data.get("key", "")

    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            response = await http_client.get(
                f"{url}/rest/v1/",
                headers={"apikey": key, "Authorization": f"Bearer {key}"}
            )
            return {"success": response.status_code < 400, "status": response.status_code}
        except Exception as e:
            return {"success": False, "error": str(e)}


app.mount('/', StaticFiles(directory='static', html=True), name='static_root')
