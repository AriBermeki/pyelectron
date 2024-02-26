


class Connector {
    constructor() {
        this._call_number = 0;
        this._websocket = null;
        this._exposed_functions = {};
        this._call_return_callbacks = {};
        this.host = window.location.host;
        this.url= window.location.protocol === 'https:' ? 'wss://' : 'ws://' + this.host + '/PyFast';

        document.addEventListener("DOMContentLoaded", () => {
            this._websocket = new WebSocket(this.url);

            this._websocket.onopen = this._onOpen.bind(this);
            this._websocket.onmessage = this._onMessage.bind(this);
        });
    }
    setHost(hostname) {
        this.host = hostname
    }
    _callFunction(message) {
        if (message.name in this._exposed_functions) {
            try {
                const return_val = this._exposed_functions[message.name](
                    ...message.args
                );
                this._websocket.send(
                    this._toJSON({
                        status: "ok",
                        value: return_val,
                        return: message.call,
                    })
                );
            } catch (err) {
                debugger;
                this._websocket.send(
                    this._toJSON({
                        status: "error",
                        stack: err.stack,
                        error: err.message,
                        return: message.call,
                    })
                );
            }
        }
    }

    _returnFunction(message) {
        if (message["return"] in this._call_return_callbacks) {
            if (message["status"] === "ok") {
                this._call_return_callbacks[message["return"]].resolve(
                    message.value
                );
            } else if (
                message["status"] === "error" &&
                this._call_return_callbacks[message["return"]].reject
            ) {
                this._call_return_callbacks[message["return"]].reject(
                    message["error"]
                );
            }
        }
    }

    _onMessage(e) {
        let message = JSON.parse(e.data);
        if (message.hasOwnProperty("call")) {
            this._callFunction(message);
        } else if (message.hasOwnProperty("return")) {
            this._returnFunction(message);
        } else {
            throw "Invalid message " + message;
        }
    }

    expose(func, name) {
        if (name === undefined) {
            name = func.toString();
            const start = "function ".length,
                end = name.indexOf("(");
            name = name.substring(start, end).trim();
        }

        this._exposed_functions[name] = func;
    }

    _toJSON(obj) {
        return JSON.stringify(obj, (k, v) => (v === undefined ? null : v));
    }

    _callObject(name, args) {
        const arg_array = [];
        for (let i = 0; i < args.length; i++) {
            arg_array.push(args[i]);
        }

        const call_id = this._call_number += 1 + Math.random();
        return { call: call_id, name: name, args: arg_array };
    }

    _callReturn(call) {
        return function(callback = null) {
            if (callback != null) {
                this._call_return_callbacks[call.call] = { resolve: callback };
            } else {
                return new Promise((resolve, reject) => {
                    this._call_return_callbacks[call.call] = {
                        resolve: resolve,
                        reject: reject,
                    };
                });
            }
        }.bind(this);
    }

    _import_py_function(func_name) {
        this[func_name] = function() {
            let call_object = this._callObject(func_name, arguments);
            this._websocket.send(this._toJSON(call_object));
            return this._callReturn(call_object);
        };
    }

    _onOpen() {
        this._import_py_function("import_python_functions");
        this.import_python_functions()((functions) => {
            for (let i = 0; i < functions.length; i++) {
                const py_function = functions[i];
                this._import_py_function(py_function);
            }
            this.export_javascript_functions(
                Object.keys(this._exposed_functions)
            )();
        });
        console.log("Connected to Python backend");
    }
}


const connector = new Connector();
