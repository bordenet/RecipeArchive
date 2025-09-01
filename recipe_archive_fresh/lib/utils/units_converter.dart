
class UnitsConverter {
  static const Map<String, double> _volumeToMl = {
    // Imperial to milliliters
    'cup': 236.588,
    'cups': 236.588,
    'tablespoon': 14.787,
    'tablespoons': 14.787,
    'tbsp': 14.787,
    'teaspoon': 4.929,
    'teaspoons': 4.929,
    'tsp': 4.929,
    'fluid ounce': 29.574,
    'fluid ounces': 29.574,
    'fl oz': 29.574,
    'pint': 473.176,
    'pints': 473.176,
    'quart': 946.353,
    'quarts': 946.353,
    'gallon': 3785.41,
    'gallons': 3785.41,
    
    // Metric (already in ml/l)
    'milliliter': 1.0,
    'milliliters': 1.0,
    'ml': 1.0,
    'liter': 1000.0,
    'liters': 1000.0,
    'l': 1000.0,
  };

  static const Map<String, double> _weightToGrams = {
    // Imperial to grams
    'ounce': 28.3495,
    'ounces': 28.3495,
    'oz': 28.3495,
    'pound': 453.592,
    'pounds': 453.592,
    'lb': 453.592,
    'lbs': 453.592,
    
    // Metric (already in grams/kg)
    'gram': 1.0,
    'grams': 1.0,
    'g': 1.0,
    'kilogram': 1000.0,
    'kilograms': 1000.0,
    'kg': 1000.0,
  };


  static String convertIngredient(String ingredient, bool toMetric) {
    // Enhanced regex to handle all fraction patterns: mixed (1 3/4), simple (1/2), and decimals (1.5)
    final regex = RegExp(r'((?:\d+\s+)?\d+(?:\.\d+)?(?:/\d+)?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)(?=\s|$|,|\()');
    final matches = regex.allMatches(ingredient);
    
    String result = ingredient;
    
    // Process matches in reverse order to avoid position shifting
    final matchList = matches.toList().reversed;
    
    for (final match in matchList) {
      final amountStr = match.group(1)?.trim();
      final unit = match.group(2)?.trim().toLowerCase();
      final originalMatch = match.group(0);
      
      if (amountStr != null && unit != null && originalMatch != null) {
        // Skip if unit doesn't look like a measurement unit (too long or contains numbers)
        if (unit.length > 15 || RegExp(r'\d').hasMatch(unit)) continue;
        
        final amount = _parseAmount(amountStr);
        if (amount != null && amount > 0) {
          final convertedText = _convertMeasurement(amount, unit, toMetric);
          if (convertedText != null && convertedText.isNotEmpty) {
            result = result.replaceRange(match.start, match.end, convertedText);
          }
        }
      }
    }
    
    return result;
  }

  static double? _parseAmount(String amountStr) {
    // Handle mixed fractions like "1 3/4"
    final mixedFractionMatch = RegExp(r'^(\d+)\s+(\d+)/(\d+)$').firstMatch(amountStr);
    if (mixedFractionMatch != null) {
      final whole = int.tryParse(mixedFractionMatch.group(1)!);
      final numerator = int.tryParse(mixedFractionMatch.group(2)!);
      final denominator = int.tryParse(mixedFractionMatch.group(3)!);
      if (whole != null && numerator != null && denominator != null && denominator != 0) {
        return whole + (numerator / denominator);
      }
    }
    
    // Handle simple fractions like "3/4"
    final fractionMatch = RegExp(r'^(\d+)/(\d+)$').firstMatch(amountStr);
    if (fractionMatch != null) {
      final numerator = int.tryParse(fractionMatch.group(1)!);
      final denominator = int.tryParse(fractionMatch.group(2)!);
      if (numerator != null && denominator != null && denominator != 0) {
        return numerator / denominator;
      }
    }
    
    // Handle decimal numbers and whole numbers
    return double.tryParse(amountStr);
  }

  static String? _convertMeasurement(double amount, String unit, bool toMetric) {
    if (amount <= 0 || unit.isEmpty) return null;
    
    // Handle temperature conversions
    if (unit.contains('°f') || unit.contains('fahrenheit')) {
      if (toMetric) {
        final celsius = (amount - 32) * 5 / 9;
        return '${celsius.round()}°C';
      }
      return null; // Already imperial
    }
    
    if (unit.contains('°c') || unit.contains('celsius')) {
      if (!toMetric) {
        final fahrenheit = (amount * 9 / 5) + 32;
        return '${fahrenheit.round()}°F';
      }
      return null; // Already metric
    }
    
    // Handle volume conversions
    final volumeConversion = _volumeToMl[unit];
    if (volumeConversion != null) {
      final isCurrentlyMetric = ['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters'].contains(unit);
      
      if (toMetric && !isCurrentlyMetric) {
        // Convert to metric
        final milliliters = amount * volumeConversion;
        if (milliliters >= 1000) {
          final liters = milliliters / 1000;
          return '${_formatNumber(liters)} ${liters == 1 ? 'liter' : 'liters'}';
        } else {
          return '${_formatNumber(milliliters)} ml';
        }
      } else if (!toMetric && isCurrentlyMetric) {
        // Convert to imperial
        final milliliters = unit == 'l' || unit == 'liter' || unit == 'liters' 
            ? amount * 1000 
            : amount;
        return _convertMlToImperial(milliliters);
      }
    }
    
    // Handle weight conversions
    final weightConversion = _weightToGrams[unit];
    if (weightConversion != null) {
      final isCurrentlyMetric = ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms'].contains(unit);
      
      if (toMetric && !isCurrentlyMetric) {
        // Convert to metric
        final grams = amount * weightConversion;
        if (grams >= 1000) {
          final kilograms = grams / 1000;
          return '${_formatNumber(kilograms)} kg';
        } else {
          return '${_formatNumber(grams)} g';
        }
      } else if (!toMetric && isCurrentlyMetric) {
        // Convert to imperial
        final grams = unit == 'kg' || unit == 'kilogram' || unit == 'kilograms' 
            ? amount * 1000 
            : amount;
        return _convertGramsToImperial(grams);
      }
    }
    
    return null; // No conversion needed or not a recognized unit
  }

  static String _convertMlToImperial(double milliliters) {
    // Convert to most appropriate imperial unit
    if (milliliters >= 3785) {
      final gallons = milliliters / 3785.41;
      return '${_formatNumber(gallons)} ${gallons == 1 ? 'gallon' : 'gallons'}';
    } else if (milliliters >= 946) {
      final quarts = milliliters / 946.353;
      return '${_formatNumber(quarts)} ${quarts == 1 ? 'quart' : 'quarts'}';
    } else if (milliliters >= 473) {
      final pints = milliliters / 473.176;
      return '${_formatNumber(pints)} ${pints == 1 ? 'pint' : 'pints'}';
    } else if (milliliters >= 236) {
      final cups = milliliters / 236.588;
      return '${_formatNumber(cups)} ${cups == 1 ? 'cup' : 'cups'}';
    } else if (milliliters >= 29.5) {
      final flOz = milliliters / 29.574;
      return '${_formatNumber(flOz)} fl oz';
    } else if (milliliters >= 14.7) {
      final tbsp = milliliters / 14.787;
      return '${_formatNumber(tbsp)} ${tbsp == 1 ? 'tbsp' : 'tbsp'}';
    } else {
      final tsp = milliliters / 4.929;
      return '${_formatNumber(tsp)} ${tsp == 1 ? 'tsp' : 'tsp'}';
    }
  }

  static String _convertGramsToImperial(double grams) {
    // Convert to most appropriate imperial unit
    if (grams >= 453) {
      final pounds = grams / 453.592;
      return '${_formatNumber(pounds)} ${pounds == 1 ? 'lb' : 'lbs'}';
    } else {
      final ounces = grams / 28.3495;
      return '${_formatNumber(ounces)} ${ounces == 1 ? 'oz' : 'oz'}';
    }
  }

  static String _formatNumber(double number) {
    // Format numbers nicely for cooking measurements
    if (number == number.roundToDouble()) {
      return number.round().toString();
    } else if (number < 1) {
      // For fractions, show more precision
      final precise = (number * 100).round() / 100;
      return precise.toString().replaceAll(RegExp(r'\.?0*$'), '');
    } else {
      // For regular numbers, show reasonable precision
      final rounded = (number * 4).round() / 4; // Round to nearest quarter
      if (rounded == rounded.roundToDouble()) {
        return rounded.round().toString();
      } else {
        return rounded.toString().replaceAll(RegExp(r'\.?0*$'), '');
      }
    }
  }

  static String convertInstructions(String instructions, bool toMetric) {
    // Convert temperature references in instructions
    String result = instructions;
    
    // Fahrenheit to Celsius
    if (toMetric) {
      final fahrenheitRegex = RegExp(r'(\d+)°?\s*[Ff]');
      result = result.replaceAllMapped(fahrenheitRegex, (match) {
        final fahrenheit = double.tryParse(match.group(1)!);
        if (fahrenheit != null) {
          final celsius = ((fahrenheit - 32) * 5 / 9).round();
          return '${celsius}°C';
        }
        return match.group(0)!;
      });
    } else {
      // Celsius to Fahrenheit
      final celsiusRegex = RegExp(r'(\d+)°?\s*[Cc]');
      result = result.replaceAllMapped(celsiusRegex, (match) {
        final celsius = double.tryParse(match.group(1)!);
        if (celsius != null) {
          final fahrenheit = ((celsius * 9 / 5) + 32).round();
          return '${fahrenheit}°F';
        }
        return match.group(0)!;
      });
    }
    
    return result;
  }
}