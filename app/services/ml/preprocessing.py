"""
Advanced data preprocessing for ML algorithms.
"""

import asyncio
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.preprocessing import (
    StandardScaler, 
    MinMaxScaler, 
    RobustScaler,
    LabelEncoder,
    PowerTransformer,
)
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.feature_selection import (
    SelectKBest, 
    f_classif, 
    f_regression,
    VarianceThreshold,
    SelectFromModel,
)
from sklearn.decomposition import PCA
import logging

from .base import ProcessingContext, AlgorithmResult

logger = logging.getLogger(__name__)


class DataPreprocessor:
    """
    Advanced data preprocessing for ML pipelines.
    
    Handles missing values, scaling, feature selection, and data validation
    with optimized performance for large datasets.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize data preprocessor.
        
        Args:
            config: Preprocessing configuration
        """
        self.config = config or {}
        self.scalers = {}
        self.imputers = {}
        self.encoders = {}
        self.selectors = {}
        self.feature_names = []
        self.original_columns = []
        
    async def preprocess_dataset(
        self,
        data: List[Dict[str, Any]],
        context: ProcessingContext,
        target_column: Optional[str] = None,
        feature_columns: Optional[List[str]] = None,
    ) -> Tuple[pd.DataFrame, List[str], List[str]]:
        """
        Comprehensive data preprocessing pipeline.
        
        Args:
            data: Raw dataset
            context: Processing context
            target_column: Target column for supervised learning
            feature_columns: Specific columns to use as features
            
        Returns:
            Tuple of (processed_dataframe, feature_columns, preprocessing_steps)
        """
        preprocessing_steps = []
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        self.original_columns = df.columns.tolist()
        preprocessing_steps.append(f"Converted to DataFrame ({len(df)} rows, {len(df.columns)} cols)")
        
        # Handle sampling for large datasets
        if self.config.get('max_samples') and len(df) > self.config['max_samples']:
            sample_size = self.config['max_samples']
            if self.config.get('sampling_strategy') == 'stratified' and target_column:
                df = await self._stratified_sample(df, target_column, sample_size)
            else:
                df = df.sample(n=sample_size, random_state=self.config.get('random_state', 42))
            preprocessing_steps.append(f"Sampled {sample_size} rows")
        
        # Select feature columns
        if feature_columns:
            available_features = [col for col in feature_columns if col in df.columns]
            if not available_features:
                raise ValueError("None of the specified feature columns exist in the dataset")
            feature_columns = available_features
        else:
            # Auto-select numeric columns
            numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
            
            # Remove target column from features
            if target_column and target_column in numeric_columns:
                numeric_columns.remove(target_column)
            
            feature_columns = numeric_columns
        
        if not feature_columns:
            raise ValueError("No numeric features found for processing")
        
        preprocessing_steps.append(f"Selected {len(feature_columns)} features")
        
        # Extract feature data
        feature_df = df[feature_columns].copy()
        
        # Handle missing values
        feature_df = await self._handle_missing_values(feature_df, preprocessing_steps)
        
        # Handle outliers
        if self.config.get('handle_outliers', False):
            feature_df = await self._handle_outliers(feature_df, preprocessing_steps)
        
        # Feature scaling
        feature_df = await self._scale_features(feature_df, preprocessing_steps)
        
        # Feature selection
        if self.config.get('feature_selection', {}).get('enabled', False):
            feature_df, selected_features = await self._select_features(
                feature_df, 
                df.get(target_column) if target_column else None,
                preprocessing_steps
            )
            feature_columns = selected_features
        
        # Data validation
        await self._validate_processed_data(feature_df, preprocessing_steps)
        
        self.feature_names = feature_columns
        
        return feature_df, feature_columns, preprocessing_steps
    
    async def _stratified_sample(
        self, 
        df: pd.DataFrame, 
        target_column: str, 
        sample_size: int
    ) -> pd.DataFrame:
        """Perform stratified sampling."""
        try:
            return df.groupby(target_column, group_keys=False).apply(
                lambda x: x.sample(
                    min(len(x), max(1, int(sample_size * len(x) / len(df)))),
                    random_state=self.config.get('random_state', 42)
                )
            ).reset_index(drop=True)
        except Exception as e:
            logger.warning(f"Stratified sampling failed: {e}, using random sampling")
            return df.sample(n=sample_size, random_state=self.config.get('random_state', 42))
    
    async def _handle_missing_values(
        self, 
        df: pd.DataFrame, 
        preprocessing_steps: List[str]
    ) -> pd.DataFrame:
        """Handle missing values in the dataset."""
        missing_strategy = self.config.get('handle_missing', 'drop')
        
        # Check for missing values
        missing_count = df.isnull().sum().sum()
        if missing_count == 0:
            preprocessing_steps.append("No missing values found")
            return df
        
        if missing_strategy == "drop":
            original_len = len(df)
            df = df.dropna()
            dropped = original_len - len(df)
            preprocessing_steps.append(f"Dropped {dropped} rows with missing values")
            
        elif missing_strategy == "mean":
            imputer = SimpleImputer(strategy='mean')
            df_values = imputer.fit_transform(df)
            df = pd.DataFrame(df_values, columns=df.columns, index=df.index)
            self.imputers['mean'] = imputer
            preprocessing_steps.append("Filled missing values with mean")
            
        elif missing_strategy == "median":
            imputer = SimpleImputer(strategy='median')
            df_values = imputer.fit_transform(df)
            df = pd.DataFrame(df_values, columns=df.columns, index=df.index)
            self.imputers['median'] = imputer
            preprocessing_steps.append("Filled missing values with median")
            
        elif missing_strategy == "mode":
            imputer = SimpleImputer(strategy='most_frequent')
            df_values = imputer.fit_transform(df)
            df = pd.DataFrame(df_values, columns=df.columns, index=df.index)
            self.imputers['mode'] = imputer
            preprocessing_steps.append("Filled missing values with mode")
            
        elif missing_strategy == "knn":
            n_neighbors = self.config.get('knn_neighbors', 5)
            imputer = KNNImputer(n_neighbors=n_neighbors)
            df_values = imputer.fit_transform(df)
            df = pd.DataFrame(df_values, columns=df.columns, index=df.index)
            self.imputers['knn'] = imputer
            preprocessing_steps.append(f"Filled missing values with KNN (k={n_neighbors})")
            
        elif missing_strategy == "zero":
            df = df.fillna(0)
            preprocessing_steps.append("Filled missing values with zero")
        
        return df
    
    async def _handle_outliers(
        self, 
        df: pd.DataFrame, 
        preprocessing_steps: List[str]
    ) -> pd.DataFrame:
        """Handle outliers in the dataset."""
        outlier_method = self.config.get('outlier_method', 'iqr')
        
        if outlier_method == 'iqr':
            # IQR method
            Q1 = df.quantile(0.25)
            Q3 = df.quantile(0.75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            # Clip outliers
            original_shape = df.shape
            df = df.clip(lower=lower_bound, upper=upper_bound, axis=1)
            preprocessing_steps.append(f"Clipped outliers using IQR method")
            
        elif outlier_method == 'zscore':
            # Z-score method
            z_threshold = self.config.get('z_threshold', 3)
            z_scores = np.abs((df - df.mean()) / df.std())
            
            # Mask outliers
            mask = (z_scores < z_threshold).all(axis=1)
            original_len = len(df)
            df = df[mask]
            removed = original_len - len(df)
            preprocessing_steps.append(f"Removed {removed} outlier rows using Z-score (threshold={z_threshold})")
        
        return df
    
    async def _scale_features(
        self, 
        df: pd.DataFrame, 
        preprocessing_steps: List[str]
    ) -> pd.DataFrame:
        """Scale features using specified method."""
        scaling_method = self.config.get('scaling_method', 'standard')
        
        if scaling_method == 'none':
            preprocessing_steps.append("No feature scaling applied")
            return df
        
        if scaling_method == 'standard':
            scaler = StandardScaler()
        elif scaling_method == 'minmax':
            scaler = MinMaxScaler()
        elif scaling_method == 'robust':
            scaler = RobustScaler()
        elif scaling_method == 'power':
            scaler = PowerTransformer(method='yeo-johnson')
        else:
            logger.warning(f"Unknown scaling method: {scaling_method}, using standard")
            scaler = StandardScaler()
        
        # Fit and transform
        scaled_values = scaler.fit_transform(df)
        scaled_df = pd.DataFrame(scaled_values, columns=df.columns, index=df.index)
        
        self.scalers[scaling_method] = scaler
        preprocessing_steps.append(f"Applied {scaling_method} scaling")
        
        return scaled_df
    
    async def _select_features(
        self,
        df: pd.DataFrame,
        target: Optional[pd.Series],
        preprocessing_steps: List[str]
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Perform feature selection."""
        selection_config = self.config.get('feature_selection', {})
        method = selection_config.get('method', 'variance')
        
        if method == 'variance':
            # Variance threshold
            threshold = selection_config.get('variance_threshold', 0.0)
            selector = VarianceThreshold(threshold=threshold)
            selected_features = selector.fit_transform(df)
            
            # Get selected feature names
            selected_mask = selector.get_support()
            selected_columns = df.columns[selected_mask].tolist()
            
            df_selected = pd.DataFrame(
                selected_features, 
                columns=selected_columns, 
                index=df.index
            )
            
            self.selectors['variance'] = selector
            preprocessing_steps.append(f"Selected {len(selected_columns)} features using variance threshold")
            
        elif method == 'univariate' and target is not None:
            # Univariate feature selection
            k = selection_config.get('k_features', 10)
            
            # Choose scoring function based on target type
            if target.dtype in ['object', 'category'] or len(target.unique()) < 10:
                score_func = f_classif
            else:
                score_func = f_regression
            
            selector = SelectKBest(score_func=score_func, k=min(k, df.shape[1]))
            selected_features = selector.fit_transform(df, target)
            
            # Get selected feature names
            selected_mask = selector.get_support()
            selected_columns = df.columns[selected_mask].tolist()
            
            df_selected = pd.DataFrame(
                selected_features,
                columns=selected_columns,
                index=df.index
            )
            
            self.selectors['univariate'] = selector
            preprocessing_steps.append(f"Selected top {len(selected_columns)} features using univariate selection")
            
        elif method == 'model_based' and target is not None:
            # Model-based feature selection
            from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
            
            # Choose model based on target type
            if target.dtype in ['object', 'category'] or len(target.unique()) < 10:
                model = RandomForestClassifier(n_estimators=100, random_state=42)
            else:
                model = RandomForestRegressor(n_estimators=100, random_state=42)
            
            selector = SelectFromModel(model)
            selected_features = selector.fit_transform(df, target)
            
            # Get selected feature names
            selected_mask = selector.get_support()
            selected_columns = df.columns[selected_mask].tolist()
            
            df_selected = pd.DataFrame(
                selected_features,
                columns=selected_columns,
                index=df.index
            )
            
            self.selectors['model_based'] = selector
            preprocessing_steps.append(f"Selected {len(selected_columns)} features using model-based selection")
            
        else:
            # No feature selection
            df_selected = df
            selected_columns = df.columns.tolist()
            preprocessing_steps.append("No feature selection applied")
        
        return df_selected, selected_columns
    
    async def _validate_processed_data(
        self, 
        df: pd.DataFrame, 
        preprocessing_steps: List[str]
    ):
        """Validate processed data quality."""
        validation_issues = []
        
        # Check for infinite values
        inf_count = np.isinf(df.values).sum()
        if inf_count > 0:
            validation_issues.append(f"Found {inf_count} infinite values")
        
        # Check for NaN values
        nan_count = df.isnull().sum().sum()
        if nan_count > 0:
            validation_issues.append(f"Found {nan_count} NaN values after preprocessing")
        
        # Check for constant features
        constant_features = df.columns[df.nunique() <= 1].tolist()
        if constant_features:
            validation_issues.append(f"Found {len(constant_features)} constant features")
        
        # Check data types
        non_numeric = df.select_dtypes(exclude=[np.number]).columns.tolist()
        if non_numeric:
            validation_issues.append(f"Found {len(non_numeric)} non-numeric columns")
        
        # Check minimum samples
        min_samples = self.config.get('min_samples', 10)
        if len(df) < min_samples:
            validation_issues.append(f"Insufficient samples: {len(df)} < {min_samples}")
        
        if validation_issues:
            warning_msg = "Data validation warnings: " + "; ".join(validation_issues)
            logger.warning(warning_msg)
            preprocessing_steps.append(f"Validation warnings: {len(validation_issues)} issues found")
        else:
            preprocessing_steps.append("Data validation passed")
    
    def transform_new_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """Transform new data using fitted preprocessors."""
        if not self.feature_names:
            raise ValueError("Preprocessor not fitted. Call preprocess_dataset first.")
        
        # Select features
        if not all(col in data.columns for col in self.feature_names):
            missing_cols = [col for col in self.feature_names if col not in data.columns]
            raise ValueError(f"Missing columns in new data: {missing_cols}")
        
        df = data[self.feature_names].copy()
        
        # Apply fitted transformations
        for name, imputer in self.imputers.items():
            df = pd.DataFrame(
                imputer.transform(df),
                columns=df.columns,
                index=df.index
            )
        
        for name, scaler in self.scalers.items():
            df = pd.DataFrame(
                scaler.transform(df),
                columns=df.columns,
                index=df.index
            )
        
        for name, selector in self.selectors.items():
            selected_features = selector.transform(df)
            selected_mask = selector.get_support()
            selected_columns = df.columns[selected_mask].tolist()
            df = pd.DataFrame(
                selected_features,
                columns=selected_columns,
                index=df.index
            )
        
        return df
    
    def get_preprocessing_summary(self) -> Dict[str, Any]:
        """Get summary of preprocessing operations."""
        return {
            "original_columns": len(self.original_columns),
            "selected_features": len(self.feature_names),
            "feature_names": self.feature_names,
            "transformers_fitted": {
                "imputers": list(self.imputers.keys()),
                "scalers": list(self.scalers.keys()),
                "selectors": list(self.selectors.keys()),
            },
            "config_used": self.config,
        }