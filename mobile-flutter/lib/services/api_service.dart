import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://convee-education-977864306871.asia-south1.run.app/api/v1';

  static final Dio dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
      },
    ),
  );

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken');
    final orgId = prefs.getString('currentOrgId');

    if (token != null) {
      dio.options.headers['Authorization'] = 'Bearer $token';
    }
    if (orgId != null) {
      dio.options.headers['X-Organization-Id'] = orgId;
    }

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final p = await SharedPreferences.getInstance();
          final t = p.getString('accessToken');
          final o = p.getString('currentOrgId');
          if (t != null) {
            options.headers['Authorization'] = 'Bearer $t';
          }
          if (o != null) {
            options.headers['X-Organization-Id'] = o;
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          return handler.next(error);
        },
      ),
    );
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    String? portalMode,
  }) async {
    final response = await dio.post('/auth/login', data: {
      'email': email,
      'password': password,
      if (portalMode != null) 'portalMode': portalMode,
    });

    final data = response.data as Map<String, dynamic>;
    final prefs = await SharedPreferences.getInstance();

    if (data['accessToken'] != null) {
      await prefs.setString('accessToken', data['accessToken'].toString());
      dio.options.headers['Authorization'] = 'Bearer ${data['accessToken']}';
    }
    if (data['refreshToken'] != null) {
      await prefs.setString('refreshToken', data['refreshToken'].toString());
    }
    if (data['org'] != null && data['org']['id'] != null) {
      await prefs.setString('currentOrgId', data['org']['id'].toString());
      dio.options.headers['X-Organization-Id'] = data['org']['id'].toString();
    }

    return data;
  }

  static Future<Map<String, dynamic>?> getMe() async {
    try {
      final res = await dio.get('/auth/me');
      return res.data as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<String?> getDailyBriefing(String orgId) async {
    try {
      final res = await dio.get('/ai/daily-briefing', queryParameters: {'orgId': orgId});
      return res.data['briefing']?.toString();
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> getDashboard(String orgId) async {
    try {
      final res = await dio.get('/dashboard/employee', queryParameters: {'orgId': orgId});
      return res.data as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>?> getAttendanceStats(String orgId) async {
    try {
      final res = await dio.get('/attendance/stats', queryParameters: {'orgId': orgId});
      return res.data as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    await prefs.remove('refreshToken');
    await prefs.remove('currentOrgId');
    dio.options.headers.remove('Authorization');
    dio.options.headers.remove('X-Organization-Id');
  }
}
