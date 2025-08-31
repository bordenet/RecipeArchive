package com.recipearchive.android.presentation.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.recipearchive.android.presentation.theme.RecipeArchiveTheme

@Composable
fun StarRating(
    rating: Float,
    onRatingChanged: (Float) -> Unit,
    modifier: Modifier = Modifier,
    maxRating: Int = 5,
    starSize: Int = 24,
    isReadOnly: Boolean = false
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        for (i in 1..maxRating) {
            val isFilled = i <= rating.toInt()
            val isHalfFilled = i - 0.5f <= rating && rating < i
            
            Icon(
                imageVector = when {
                    isFilled -> Icons.Filled.Star
                    isHalfFilled -> Icons.Filled.Star // For simplicity, we'll use filled for half stars too
                    else -> Icons.Outlined.Star
                },
                contentDescription = "Star $i",
                modifier = Modifier
                    .size(starSize.dp)
                    .clickable(enabled = !isReadOnly) {
                        onRatingChanged(i.toFloat())
                    },
                tint = if (isFilled || isHalfFilled) {
                    Color(0xFFFFD700) // Gold color for filled stars
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
        
        if (rating > 0) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "%.1f".format(rating),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun InteractiveStarRating(
    initialRating: Float,
    onRatingChanged: (Float) -> Unit,
    modifier: Modifier = Modifier,
    maxRating: Int = 5
) {
    var currentRating by remember(initialRating) { mutableStateOf(initialRating) }
    
    StarRating(
        rating = currentRating,
        onRatingChanged = { newRating ->
            currentRating = newRating
            onRatingChanged(newRating)
        },
        modifier = modifier,
        maxRating = maxRating
    )
}

@Composable
fun ReadOnlyStarRating(
    rating: Float,
    modifier: Modifier = Modifier,
    maxRating: Int = 5,
    starSize: Int = 20
) {
    StarRating(
        rating = rating,
        onRatingChanged = { },
        modifier = modifier,
        maxRating = maxRating,
        starSize = starSize,
        isReadOnly = true
    )
}

@Preview(showBackground = true)
@Composable
private fun StarRatingPreview() {
    RecipeArchiveTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Interactive Rating:")
            InteractiveStarRating(
                initialRating = 3.5f,
                onRatingChanged = { }
            )
            
            Text("Read-only Rating:")
            ReadOnlyStarRating(rating = 4.0f)
            
            Text("Empty Rating:")
            ReadOnlyStarRating(rating = 0f)
        }
    }
}