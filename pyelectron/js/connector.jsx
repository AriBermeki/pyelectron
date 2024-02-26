import React, { createContext, useContext, useEffect, useState } from 'react';

const PyFastContext = createContext();

export const usePyFast = () => {
  return useContext(PyFastContext);
};

export const PyFastProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const host = window.location.host;
  const url = window.location.protocol === 'https:' ? 'wss://' : 'ws://' + host + '/PyFast';

  useEffect(() => {

    
    const newSocket = new WebSocket(url);
    setSocket(newSocket);

    const _onMessage = (e) => {
      let message = JSON.parse(e.data);
      if (message.hasOwnProperty("call")) {
        _callFunction(message);
      } else if (message.hasOwnProperty("return")) {
        _returnFunction(message);
      } else {
        throw "Invalid message " + message;
      }
    };

    const _callFunction = (message) => {
      if (message.name in _exposed_functions) {
        try {
          const return_val = _exposed_functions[message.name](...message.args);
          socket.send(_toJSON({
            status: "ok",
            value: return_val,
            return: message.call,
          }));
        } catch (err) {
          debugger;
          socket.send(_toJSON({
            status: "error",
            stack: err.stack,
            error: err.message,
            return: message.call,
          }));
        }
      }
    };

    const _returnFunction = (message) => {
      if (message["return"] in _call_return_callbacks) {
        if (message["status"] === "ok") {
          _call_return_callbacks[message["return"]].resolve(message.value);
        } else if (message["status"] === "error" && _call_return_callbacks[message["return"]].reject) {
          _call_return_callbacks[message["return"]].reject(message["error"]);
        }
      }
    };

    newSocket.onopen = () => {
      setConnected(true);
      _onOpen();
    };

    newSocket.onclose = () => {
      setConnected(false);
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    newSocket.onmessage = _onMessage;

    return () => {
      newSocket.close();
    };
  }, []);

  const setHost = (hostname) => {
    host = hostname;
  };

  const expose = (func, name) => {
    if (name === undefined) {
      name = func.toString();
      const start = "function ".length,
        end = name.indexOf("(");
      name = name.substring(start, end).trim();
    }
    _exposed_functions[name] = func;
  };

  const _toJSON = (obj) => {
    return JSON.stringify(obj, (k, v) => (v === undefined ? null : v));
  };

  const _callObject = (name, args) => {
    const arg_array = [];
    for (let i = 0; i < args.length; i++) {
      arg_array.push(args[i]);
    }

    const call_id = _call_number += 1 + Math.random();
    return { call: call_id, name: name, args: arg_array };
  };

  const _callReturn = (call) => {
    return function (callback = null) {
      if (callback != null) {
        _call_return_callbacks[call.call] = { resolve: callback };
      } else {
        return new Promise((resolve, reject) => {
          _call_return_callbacks[call.call] = {
            resolve: resolve,
            reject: reject,
          };
        });
      }
    };
  };

  const _import_py_function = (func_name) => {
    this[func_name] = function () {
      let call_object = _callObject(func_name, arguments);
      socket.send(_toJSON(call_object));
      return _callReturn(call_object);
    };
  };

  const _onOpen = () => {
    _import_py_function("import_python_functions");
    this.import_python_functions()((functions) => {
      for (let i = 0; i < functions.length; i++) {
        const py_function = functions[i];
        _import_py_function(py_function);
      }
      this.export_javascript_functions(Object.keys(_exposed_functions))();
    });
    console.log("Connected to Python backend");
  };
  const contextValue = useMemo(() => ({
    socket,
    expose,
    setHost,
    connected

  }), [socket, expose, setHost, connected]);
  return (
    <WebSocketContext.Provider value={{contextValue}}>
      {children}
    </WebSocketContext.Provider>
  );
};
