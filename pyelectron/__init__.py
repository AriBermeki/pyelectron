from .exposer import expose, EXPOSED_FUNCTIONS
from .server import init, _javascript_call

@expose
def import_python_functions():
    return list(EXPOSED_FUNCTIONS.keys())

@expose
def export_javascript_functions(functions: list):
    for f in functions:
        #globals()[f] = lambda *args: _javascript_call(f, args)
        exec('%s = lambda *args: _javascript_call("%s", args)' % (f, f), globals())

