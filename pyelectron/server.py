from .handler import connect_websocket, spawn, _javascript_call, websocket_client
import uvicorn
from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect, WebSocketException
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path





def init(app: FastAPI = None):

    def get_js_file(js_filename: str):
        folder_path = Path(__file__).parent / 'js'
        files = list(folder_path.rglob(js_filename))

        if files:
            file_path = files[0]
            return FileResponse(path=file_path, media_type='text/javascript')
        else:
            print(f'Die Datei {js_filename} wurde nicht gefunden.')
            return {"error": f"Datei {js_filename} nicht gefunden"}
        

    async def get_sic_socket_js():
        return get_js_file("pyfast.js") 


    app.add_api_route("/pyfast.js", endpoint=get_sic_socket_js)



    @app.websocket("/PyFast")
    async def websocket_endpoint(websocket: WebSocket):
        try:
            await websocket.accept()
            websocket_client.websocket = websocket
            while True:
                message = await websocket.receive_text()
                if message:
                    await websocket_client.on_message(websocket, message)
                else:
                    break
        except WebSocketDisconnect:
            await websocket_client.handle_disconnect(websocket)
        except WebSocketException as e:
            raise HTTPException(status_code=400, detail=str(e))
