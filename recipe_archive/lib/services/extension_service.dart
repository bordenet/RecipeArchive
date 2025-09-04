// Conditional export based on platform
export 'extension_service_web.dart'
    if (dart.library.io) 'extension_service_io.dart';