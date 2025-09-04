import 'package:flutter/material.dart';

class StarRating extends StatelessWidget {
  final double rating;
  final ValueChanged<double>? onRatingChanged;
  final double size;
  final Color color;
  final Color unselectedColor;
  final bool readOnly;

  const StarRating({
    super.key,
    required this.rating,
    this.onRatingChanged,
    this.size = 24.0,
    this.color = Colors.amber,
    this.unselectedColor = Colors.grey,
    this.readOnly = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        return GestureDetector(
          onTap: readOnly || onRatingChanged == null 
              ? null 
              : () => onRatingChanged!(index + 1.0),
          child: Icon(
            index < rating.floor()
                ? Icons.star
                : index < rating
                    ? Icons.star_half
                    : Icons.star_border,
            size: size,
            color: index < rating ? color : unselectedColor,
          ),
        );
      }),
    );
  }
}

class InteractiveStarRating extends StatefulWidget {
  final double initialRating;
  final ValueChanged<double> onRatingChanged;
  final double size;
  final Color color;
  final Color unselectedColor;

  const InteractiveStarRating({
    super.key,
    required this.initialRating,
    required this.onRatingChanged,
    this.size = 24.0,
    this.color = Colors.amber,
    this.unselectedColor = Colors.grey,
  });

  @override
  State<InteractiveStarRating> createState() => _InteractiveStarRatingState();
}

class _InteractiveStarRatingState extends State<InteractiveStarRating> {
  late double _rating;

  @override
  void initState() {
    super.initState();
    _rating = widget.initialRating;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        return GestureDetector(
          onTap: () {
            setState(() {
              _rating = index + 1.0;
            });
            widget.onRatingChanged(_rating);
          },
          child: MouseRegion(
            cursor: SystemMouseCursors.click,
            child: Icon(
              index < _rating.floor()
                  ? Icons.star
                  : index < _rating
                      ? Icons.star_half
                      : Icons.star_border,
              size: widget.size,
              color: index < _rating ? widget.color : widget.unselectedColor,
            ),
          ),
        );
      }),
    );
  }
}