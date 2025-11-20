import 'package:flutter_dotenv/flutter_dotenv.dart';

class Config {
  static String get apiBaseUrl =>
      dotenv.env['API_BASE_URL'] ??
      'https://your-api-gateway-id.execute-api.us-west-2.amazonaws.com/prod';

  static const String appVersion = '1.0.0';
}
