import React, { useId, useRef } from "react";
import type { SearchPlacePrediction } from "../../model/search";
import styles from "./SearchBar.module.css";
import { SearchBarPopover } from "./SearchBarPopover";

interface SearchDestinationFieldProps {
  value: string;
  suggestions: string[];
  isLoading: boolean;
  isActive: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
}

type SearchDestinationSuggestion = SearchPlacePrediction | string;

interface SearchDestinationFieldInternalProps extends Omit<
  SearchDestinationFieldProps,
  "onSelect" | "suggestions"
> {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isComposing?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onCompositionEnd?: () => void;
  onCompositionStart?: () => void;
  onEnterWithoutSuggestion?: () => void;
  onEscape?: () => void;
  onInputClick?: React.MouseEventHandler<HTMLInputElement>;
  onRequestSuggestions?: () => void;
  onSelect: (value: SearchDestinationSuggestion) => void;
  showClearButton?: boolean;
  showSuggestionIcons?: boolean;
  shouldClearOnValueChange?: boolean;
  suggestions: SearchDestinationSuggestion[];
  suggestionsRef?: React.Ref<HTMLDivElement>;
}

const isPlacePrediction = (
  suggestion: SearchDestinationSuggestion,
): suggestion is SearchPlacePrediction => typeof suggestion !== "string";

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
  showClearButton = false,
  showSuggestionIcons = false,
  shouldClearOnValueChange = false,
  suggestions,
  suggestionsRef,
  value,
}: SearchDestinationFieldInternalProps) => {
  const suggestionsId = useId();
  const suggestionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isSuggestionPopoverOpen =
    isActive && (suggestions.length > 0 || isLoading);

  const focusSuggestion = (index: number) => {
    const suggestionButtons = suggestionButtonRefs.current.filter(
      (button): button is HTMLButtonElement => button !== null,
    );

    if (suggestionButtons.length === 0) {
      return;
    }

    const nextIndex =
      (index + suggestionButtons.length) % suggestionButtons.length;
    suggestionButtons[nextIndex]?.focus();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;

    if (shouldClearOnValueChange && nextValue !== value) {
      onClear();
    }

    onChange(nextValue);
    onRequestSuggestions?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      isSuggestionPopoverOpen &&
      suggestions.length > 0 &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      event.stopPropagation();
      focusSuggestion(event.key === "ArrowDown" ? 0 : suggestions.length - 1);
      return;
    }

    if (
      event.key === "Enter" &&
      !isComposing &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault();
      event.stopPropagation();

      const firstSuggestion = suggestions[0];
      if (isActive && firstSuggestion) {
        onSelect(firstSuggestion);
        return;
      }

      onEnterWithoutSuggestion?.();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onEscape?.();
    }
  };

  const handleSuggestionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusSuggestion(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusSuggestion(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusSuggestion(0);
        break;
      case "End":
        event.preventDefault();
        focusSuggestion(suggestions.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className={styles.label}>여행지</div>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          aria-label="여행지"
          aria-autocomplete="list"
          aria-busy={isLoading}
          aria-controls={isSuggestionPopoverOpen ? suggestionsId : undefined}
          aria-expanded={isSuggestionPopoverOpen}
          aria-haspopup="dialog"
          role="combobox"
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
        {showClearButton && value.length > 0 && (
          <button
            aria-label="여행지 입력 지우기"
            className={styles.destinationClearButton}
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          </button>
        )}
        {isSuggestionPopoverOpen && (
          <SearchBarPopover
            id={suggestionsId}
            ref={suggestionsRef}
            triggerRef={inputRef}
            variant="suggestions"
            onClose={() => onEscape?.()}
          >
            {isLoading && (
              <div
                aria-live="polite"
                className={styles.suggestionStatus}
                role="status"
              >
                여행지를 찾는 중입니다.
              </div>
            )}
            {suggestions.map((suggestion, index) => (
              <button
                key={getSuggestionKey(suggestion)}
                className={styles.suggestionItem}
                onKeyDown={(event) => handleSuggestionKeyDown(event, index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSelect(suggestion);
                }}
                ref={(node) => {
                  suggestionButtonRefs.current[index] = node;
                }}
                type="button"
              >
                {showSuggestionIcons && (
                  <span aria-hidden="true" className={styles.suggestionIcon}>
                    <svg viewBox="0 0 24 24">
                      <path d="M12 21s6-5.35 6-11a6 6 0 1 0-12 0c0 5.65 6 11 6 11Z" />
                      <circle cx="12" cy="10" r="2.2" />
                    </svg>
                  </span>
                )}
                <span className={styles.suggestionText}>
                  <span className={styles.suggestionMainText}>
                    {getSuggestionMainText(suggestion)}
                  </span>
                  {getSuggestionSecondaryText(suggestion) && (
                    <span className={styles.suggestionSecondaryText}>
                      {getSuggestionSecondaryText(suggestion)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </SearchBarPopover>
        )}
      </div>
    </>
  );
};
