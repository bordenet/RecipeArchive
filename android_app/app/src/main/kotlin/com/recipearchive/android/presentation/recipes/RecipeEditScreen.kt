package com.recipearchive.android.presentation.recipes

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.presentation.components.StarRating
import com.recipearchive.android.presentation.components.TagChip
import com.recipearchive.android.presentation.theme.RecipeArchiveTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipeEditScreen(
    recipe: Recipe,
    onNavigateUp: () -> Unit,
    viewModel: RecipeEditViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    
    // Initialize with recipe data
    LaunchedEffect(recipe) {
        viewModel.initializeWithRecipe(recipe)
    }
    
    // Handle navigation on successful save
    LaunchedEffect(uiState.isSaveSuccessful) {
        if (uiState.isSaveSuccessful) {
            onNavigateUp()
        }
    }
    
    var selectedTabIndex by remember { mutableStateOf(0) }
    val tabTitles = listOf("Basic", "Ingredients", "Instructions", "Personal")
    
    // Unsaved changes dialog
    var showUnsavedChangesDialog by remember { mutableStateOf(false) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit Recipe") },
                navigationIcon = {
                    IconButton(onClick = {
                        if (uiState.hasUnsavedChanges) {
                            showUnsavedChangesDialog = true
                        } else {
                            onNavigateUp()
                        }
                    }) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                },
                actions = {
                    TextButton(
                        onClick = { viewModel.saveRecipe() },
                        enabled = uiState.hasUnsavedChanges && !uiState.isLoading
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Save")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tab Row
            TabRow(selectedTabIndex = selectedTabIndex) {
                tabTitles.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        text = { Text(title) }
                    )
                }
            }
            
            // Tab Content
            when (selectedTabIndex) {
                0 -> BasicInfoTab(viewModel = viewModel, uiState = uiState)
                1 -> IngredientsTab(viewModel = viewModel, uiState = uiState)
                2 -> InstructionsTab(viewModel = viewModel, uiState = uiState)
                3 -> PersonalTab(viewModel = viewModel, uiState = uiState)
            }
        }
    }
    
    // Dialogs
    if (showUnsavedChangesDialog) {
        AlertDialog(
            onDismissRequest = { showUnsavedChangesDialog = false },
            title = { Text("Unsaved Changes") },
            text = { Text("You have unsaved changes. Are you sure you want to discard them?") },
            confirmButton = {
                TextButton(onClick = {
                    showUnsavedChangesDialog = false
                    onNavigateUp()
                }) {
                    Text("Discard")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnsavedChangesDialog = false }) {
                    Text("Keep Editing")
                }
            }
        )
    }
    
    // Error dialog
    if (uiState.errorMessage != null) {
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            title = { Text("Error") },
            text = { Text(uiState.errorMessage) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearError() }) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
private fun BasicInfoTab(
    viewModel: RecipeEditViewModel,
    uiState: RecipeEditUiState,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Title
        OutlinedTextField(
            value = uiState.title,
            onValueChange = viewModel::updateTitle,
            label = { Text("Recipe Title") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        
        // Description
        OutlinedTextField(
            value = uiState.description,
            onValueChange = viewModel::updateDescription,
            label = { Text("Description") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 4
        )
        
        // Times and Servings Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = uiState.prepTime?.toString() ?: "",
                onValueChange = { viewModel.updatePrepTime(it.toIntOrNull()) },
                label = { Text("Prep (min)") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
            
            OutlinedTextField(
                value = uiState.cookingTime?.toString() ?: "",
                onValueChange = { viewModel.updateCookingTime(it.toIntOrNull()) },
                label = { Text("Cook (min)") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
            
            OutlinedTextField(
                value = uiState.servings.toString(),
                onValueChange = { viewModel.updateServings(it.toIntOrNull() ?: 1) },
                label = { Text("Servings") },
                modifier = Modifier.weight(1f),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true
            )
        }
        
        // Difficulty and Cuisine Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = uiState.difficulty,
                onValueChange = viewModel::updateDifficulty,
                label = { Text("Difficulty") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            
            OutlinedTextField(
                value = uiState.cuisine,
                onValueChange = viewModel::updateCuisine,
                label = { Text("Cuisine") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
        }
        
        // Tags Section
        TagsSection(
            tags = uiState.tags,
            onAddTag = viewModel::addTag,
            onRemoveTag = viewModel::removeTag
        )
    }
}

@Composable
private fun IngredientsTab(
    viewModel: RecipeEditViewModel,
    uiState: RecipeEditUiState,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Ingredients",
                style = MaterialTheme.typography.headlineSmall
            )
            
            Button(
                onClick = { viewModel.addIngredient() }
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add ingredient")
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Column(
            modifier = Modifier.verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            uiState.ingredients.forEachIndexed { index, ingredient ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${index + 1}.",
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.width(32.dp)
                        )
                        
                        OutlinedTextField(
                            value = ingredient,
                            onValueChange = { viewModel.updateIngredient(index, it) },
                            label = { Text("Ingredient") },
                            modifier = Modifier.weight(1f),
                            maxLines = 2
                        )
                        
                        IconButton(
                            onClick = { viewModel.removeIngredient(index) }
                        ) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Remove ingredient",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
            
            if (uiState.ingredients.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No ingredients added yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InstructionsTab(
    viewModel: RecipeEditViewModel,
    uiState: RecipeEditUiState,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Instructions",
                style = MaterialTheme.typography.headlineSmall
            )
            
            Button(
                onClick = { viewModel.addInstruction() }
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add instruction")
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add Step")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Column(
            modifier = Modifier.verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            uiState.instructions.forEachIndexed { index, instruction ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        // Step number circle
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .padding(top = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Surface(
                                modifier = Modifier.size(24.dp),
                                shape = MaterialTheme.shapes.small,
                                color = MaterialTheme.colorScheme.primary
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = "${index + 1}",
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            }
                        }
                        
                        Spacer(modifier = Modifier.width(12.dp))
                        
                        OutlinedTextField(
                            value = instruction,
                            onValueChange = { viewModel.updateInstruction(index, it) },
                            label = { Text("Step ${index + 1}") },
                            modifier = Modifier.weight(1f),
                            minLines = 2,
                            maxLines = 6
                        )
                        
                        Spacer(modifier = Modifier.width(8.dp))
                        
                        IconButton(
                            onClick = { viewModel.removeInstruction(index) }
                        ) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Remove instruction",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
            
            if (uiState.instructions.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No instructions added yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PersonalTab(
    viewModel: RecipeEditViewModel,
    uiState: RecipeEditUiState,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Favorite Toggle
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Favorite Recipe",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Mark as a favorite recipe",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                Switch(
                    checked = uiState.isFavorite,
                    onCheckedChange = viewModel::updateIsFavorite
                )
            }
        }
        
        // Personal Rating
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Text(
                    text = "Personal Rating",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "Rate this recipe (1-5 stars)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    StarRating(
                        rating = uiState.personalRating ?: 0f,
                        onRatingChanged = viewModel::updatePersonalRating,
                        modifier = Modifier.weight(1f)
                    )
                    
                    if (uiState.personalRating != null) {
                        TextButton(
                            onClick = { viewModel.updatePersonalRating(null) }
                        ) {
                            Text("Clear")
                        }
                    }
                }
            }
        }
        
        // Personal Yield
        OutlinedTextField(
            value = uiState.personalYield?.toString() ?: "",
            onValueChange = { viewModel.updatePersonalYield(it.toIntOrNull()) },
            label = { Text("Personal Preferred Yield") },
            supportingText = { Text("Your preferred number of servings") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true
        )
        
        // Personal Notes
        OutlinedTextField(
            value = uiState.personalNotes,
            onValueChange = viewModel::updatePersonalNotes,
            label = { Text("Personal Notes") },
            supportingText = { Text("Your thoughts about this recipe") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 6
        )
        
        // Cooking Notes
        OutlinedTextField(
            value = uiState.cookingNotes,
            onValueChange = viewModel::updateCookingNotes,
            label = { Text("Cooking Notes") },
            supportingText = { Text("Tips and modifications you've made") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 6
        )
        
        // Categories Section
        CategoriesSection(
            categories = uiState.categories,
            onAddCategory = viewModel::addCategory,
            onRemoveCategory = viewModel::removeCategory
        )
    }
}

@Composable
private fun TagsSection(
    tags: List<String>,
    onAddTag: (String) -> Unit,
    onRemoveTag: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showAddDialog by remember { mutableStateOf(false) }
    
    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Tags",
                style = MaterialTheme.typography.titleMedium
            )
            
            TextButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Tag")
            }
        }
        
        if (tags.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tags.forEach { tag ->
                    TagChip(
                        text = tag,
                        onRemove = { onRemoveTag(tag) }
                    )
                }
            }
        } else {
            Text(
                text = "No tags added",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
    
    if (showAddDialog) {
        var newTag by remember { mutableStateOf("") }
        
        AlertDialog(
            onDismissRequest = { 
                showAddDialog = false 
                newTag = ""
            },
            title = { Text("Add Tag") },
            text = {
                OutlinedTextField(
                    value = newTag,
                    onValueChange = { newTag = it },
                    label = { Text("Tag name") },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newTag.isNotBlank()) {
                            onAddTag(newTag.trim())
                            newTag = ""
                            showAddDialog = false
                        }
                    }
                ) {
                    Text("Add")
                }
            },
            dismissButton = {
                TextButton(onClick = { 
                    showAddDialog = false
                    newTag = ""
                }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun CategoriesSection(
    categories: List<String>,
    onAddCategory: (String) -> Unit,
    onRemoveCategory: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showAddDialog by remember { mutableStateOf(false) }
    
    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Personal Categories",
                style = MaterialTheme.typography.titleMedium
            )
            
            TextButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Category")
            }
        }
        
        if (categories.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                categories.forEach { category ->
                    TagChip(
                        text = category,
                        onRemove = { onRemoveCategory(category) },
                        backgroundColor = MaterialTheme.colorScheme.secondary
                    )
                }
            }
        } else {
            Text(
                text = "No categories added",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
    
    if (showAddDialog) {
        var newCategory by remember { mutableStateOf("") }
        
        AlertDialog(
            onDismissRequest = { 
                showAddDialog = false 
                newCategory = ""
            },
            title = { Text("Add Category") },
            text = {
                OutlinedTextField(
                    value = newCategory,
                    onValueChange = { newCategory = it },
                    label = { Text("Category name") },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newCategory.isNotBlank()) {
                            onAddCategory(newCategory.trim())
                            newCategory = ""
                            showAddDialog = false
                        }
                    }
                ) {
                    Text("Add")
                }
            },
            dismissButton = {
                TextButton(onClick = { 
                    showAddDialog = false
                    newCategory = ""
                }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun RecipeEditScreenPreview() {
    RecipeArchiveTheme {
        RecipeEditScreen(
            recipe = Recipe.sample(),
            onNavigateUp = {}
        )
    }
}