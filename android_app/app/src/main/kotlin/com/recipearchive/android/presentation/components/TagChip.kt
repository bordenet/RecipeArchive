package com.recipearchive.android.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.recipearchive.android.presentation.theme.RecipeArchiveTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagChip(
    text: String,
    onRemove: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    backgroundColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = MaterialTheme.colorScheme.onPrimary
) {
    AssistChip(
        onClick = { },
        label = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = text,
                    color = contentColor,
                    style = MaterialTheme.typography.labelMedium
                )
                
                if (onRemove != null) {
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier.size(16.dp)
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Remove $text",
                            tint = contentColor.copy(alpha = 0.7f),
                            modifier = Modifier.size(12.dp)
                        )
                    }
                }
            }
        },
        modifier = modifier,
        colors = AssistChipDefaults.assistChipColors(
            containerColor = backgroundColor,
            labelColor = contentColor
        ),
        border = null
    )
}

@Composable
fun ReadOnlyTagChip(
    text: String,
    modifier: Modifier = Modifier,
    backgroundColor: Color = MaterialTheme.colorScheme.secondaryContainer,
    contentColor: Color = MaterialTheme.colorScheme.onSecondaryContainer
) {
    TagChip(
        text = text,
        onRemove = null,
        modifier = modifier,
        backgroundColor = backgroundColor,
        contentColor = contentColor
    )
}

@Composable
fun EditableTagChip(
    text: String,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
    backgroundColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = MaterialTheme.colorScheme.onPrimary
) {
    TagChip(
        text = text,
        onRemove = onRemove,
        modifier = modifier,
        backgroundColor = backgroundColor,
        contentColor = contentColor
    )
}

@Composable
fun CategoryChip(
    text: String,
    onRemove: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    TagChip(
        text = text,
        onRemove = onRemove,
        modifier = modifier,
        backgroundColor = MaterialTheme.colorScheme.secondary,
        contentColor = MaterialTheme.colorScheme.onSecondary
    )
}

@Preview(showBackground = true)
@Composable
private fun TagChipPreview() {
    RecipeArchiveTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("Editable Tags:")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                EditableTagChip(
                    text = "Dessert",
                    onRemove = { }
                )
                EditableTagChip(
                    text = "Chocolate",
                    onRemove = { }
                )
            }
            
            Text("Read-only Tags:")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReadOnlyTagChip(text = "Easy")
                ReadOnlyTagChip(text = "30 minutes")
            }
            
            Text("Categories:")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryChip(
                    text = "Family Favorites",
                    onRemove = { }
                )
                CategoryChip(
                    text = "Quick Meals",
                    onRemove = { }
                )
            }
        }
    }
}