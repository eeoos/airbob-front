import React from "react";
import type { PlacePrediction } from "../../../../hooks/usePlacesAutocomplete";
import styles from "./SearchBar.module.css";
import { SearchBarPopover } from "./SearchBarPopover";

export interface SearchDestinationFieldProps {
  value: string;
  suggestions: string[];
  isLoading: boolean;
  isActive: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
}

type SearchDestinationSuggestion = PlacePrediction | string;

interface SearchDestinationFieldInternalProps
  extends Omit<SearchDestinationFieldProps, "onSelect" | "suggestions"> {
  inputRef?: React.Ref<HTMLInputElement>;
  isComposing?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onCompositionEnd?: () => void;
  onCompositionStart?: () => void;
  onEnterWithoutSuggestion?: () => void;
  onEscape?: () => void;
  onInputClick?: React.MouseEventHandler<HTMLInputElement>;
  onRequestSuggestions?: () => void;
  onSelect: (value: SearchDestinationSuggestion) => void;
  shouldClearOnValueChange?: boolean;
  suggestions: SearchDestinationSuggestion[];
  suggestionsRef?: React.Ref<HTMLDivElement>;
}

const isPlacePrediction = (
  suggestion: SearchDestinationSuggestion
): suggestion is PlacePrediction => typeof suggestion !== "string";

const getSuggestionKey = (suggestion: SearchDestinationSuggestion) =>
  isPlacePrediction(suggestion) ? suggestion.placeId : suggestion;

const getSuggestionMainText = (suggestion: SearchDestinationSuggestion) =>
  isPlacePrediction(suggestion) ? suggestion.mainText : suggestion;

const getSuggestionSecondaryText = (suggestion: SearchDestinationSuggestion) =>
  isPlacePrediction(suggestion) ? suggestion.secondaryText : "";

export const SearchDestinationField = ({
  inputRef,
  isActive,
  isComposing = false,
  isLoading,
  onBlur,
  onChange,
  onClear,
  onCompositionEnd,
  onCompositionStart,
  onEnterWithoutSuggestion,
  onEscape,
  onFocus,
  onInputClick,
  onRequestSuggestions,
  onSelect,
  shouldClearOnValueChange = false,
  suggestions,
  suggestionsRef,
  value,
}: SearchDestinationFieldInternalProps) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    if (shouldClearOnValueChange && nextValue !== value) {
      onClear();
    }

    onChange(nextValue);
    onRequestSuggestions?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isComposing) {
      event.preventDefault();
      event.stopPropagation();

      if (isActive && suggestions.length > 0) {
        onSelect(suggestions[0]);
        return;
      }

      onEnterWithoutSuggestion?.();
      return;
    }

    if (event.key === "Escape") {
      onEscape?.();
    }
  };

  return (
    <>
      <div className={styles.label}>여행지</div>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          placeholder="어디로 여행가세요?"
          value={value}
          onChange={handleChange}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onBlur={onBlur}
          className={styles.input}
          onClick={onInputClick}
        />
        {isActive && (suggestions.length > 0 || isLoading) && (
          <SearchBarPopover
            ref={suggestionsRef}
            variant="suggestions"
            onClose={() => onEscape?.()}
          >
            {isLoading && (
              <div className={styles.suggestionItem}>검색 중...</div>
            )}
            {suggestions.map((suggestion) => (
              <button
                key={getSuggestionKey(suggestion)}
                className={styles.suggestionItem}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSelect(suggestion);
                }}
                type="button"
              >
                <div className={styles.suggestionMainText}>
                  {getSuggestionMainText(suggestion)}
                </div>
                {getSuggestionSecondaryText(suggestion) && (
                  <div className={styles.suggestionSecondaryText}>
                    {getSuggestionSecondaryText(suggestion)}
                  </div>
                )}
              </button>
            ))}
          </SearchBarPopover>
        )}
      </div>
    </>
  );
};
