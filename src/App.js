/* @flow */
import "./App.css";
import React, { useEffect, useReducer } from "react";
import { ResponseStories, ResponseSubreddits, Story, Subreddit } from "./types";
import Navigation from "./Navigation";
import StoryList from "./StoryList";

type State = {
  // List of possible Subreddits for the user to choose in the right navigation.
  navigationItems: Array<Subreddit>,

  // The stories for the current selected Subreddit whose title and other info are shown once the
  // user navigates to one.
  storyItems: Array<Story>,

  // Current Subreddit being viewed. Its title is shown at the top of the page
  selectedSubreddit: ?Subreddit,

  //what page of results
  currentPage: number
};

const initialState = {
  navigationItems: [],
  selectedSubreddit: null,
  storyItems: [],
  currentPage: 1
};

function reducer(state: State, action): State {
  switch (action.type) {
    case "set-navigation-items":
      return {
        ...state,
        navigationItems: action.payload
      };
    case "set-selected-subreddit":
      return {
        ...state,
        selectedSubreddit: action.payload,
        storyItems: { 1: [] },
        currentPage: 1
      };
    case "set-story-items":
      return {
        ...state,
        storyItems: {
          ...state.storyItems,
          [action.payload.page]: action.payload.storyItems
        },
        currentPage: 1
      };
    case "set-story-page":
      return {
        ...state,
        currentPage: action.payload
      };
    default:
      throw new Error();
  }
}

// Pending callback name for the stories request. This lives outside the `App` because it assumes
// only a single `App` is rendered at a given time. This JS module is the scope of this callback
// name and would need to be changed to support multiple Apps on a given page.
let storiesCallbackName = null;

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const documentHead = document.head;
    if (documentHead == null)
      throw new Error("No <head> to use for script injection.");

    const cbname = `fn${Date.now()}`;
    const script = document.createElement("script");
    script.src = `https://www.reddit.com/reddits.json?jsonp=${cbname}`;
    window[cbname] = (jsonData: ResponseSubreddits) => {
      dispatch({
        payload: jsonData.data.children,
        type: "set-navigation-items"
      });
      delete window[cbname];
      documentHead.removeChild(script);
    };

    // Start the JSONP request by injecting the `script` into the document.
    documentHead.appendChild(script);
  }, []);

  const setSelectedItem = (item: Subreddit) => {
    const documentHead = document.head;
    if (documentHead == null)
      throw new Error("No <head> to use for script injection.");

    const cbname = (storiesCallbackName = `fn${Date.now()}`);
    const script = document.createElement("script");
    script.src = `https://www.reddit.com${item.data.url}.json?sort=top&t=month&jsonp=${cbname}`;
    window[cbname] = (jsonData: ResponseStories) => {
      // Use the response only if this is still the latest script to run. If the user clicked
      // another Subreddit in the meantime, the `cbname` will be different and this response should
      // be ignored.
      //
      // The `<script>` must stay in the document even if the response is not needed because
      // otherwise the JSONP request will try to call a nonexistent script. Leave it in the `<head>`
      // so it can clean up after itself but make it do nothing other than clean up.
      if (cbname === storiesCallbackName) {
        let allResults = jsonData.data.children;

        // Split resutls into chunks of code
        // https://stackoverflow.com/a/37826698/1469799
        let pagedResults = allResults.reduce((resultArray, item, index) => {
          const chunkIndex = Math.floor(index / 10);

          if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []; // start a new chunk
          }

          resultArray[chunkIndex].push(item);

          return resultArray;
        }, []);

        //Set each chunk of results as a page
        pagedResults.forEach((pageOfResults, index) => {
          dispatch({
            payload: {
              storyItems: pageOfResults,
              page: index + 1
            },
            type: "set-story-items"
          });
        });
      }
      delete window[cbname];
      documentHead.removeChild(script);
    };

    // Start the JSONP request by setting the `src` of the injected script.
    documentHead.appendChild(script);

    dispatch({
      payload: item,
      type: "set-selected-subreddit"
    });
  };

  const handlePageChange = (page) => {
    dispatch({
      payload: page,
      type: "set-story-page"
    });
  };
  return (
    <React.Fragment>
      <p className="creator">
        Created by <a href="https://www.youtube.com/channel/UCwaWO9y9NZ7_UYhhoNPwqTw">Redacted</a>
        <br />
      </p>
      <h1>
        {state.selectedSubreddit == null
          ? "Choose your path"
          : state.selectedSubreddit.data.display_name}
      </h1>
      <Navigation
        activeUrl={
          state.selectedSubreddit == null
            ? null
            : state.selectedSubreddit.data.url
        }
        items={state.navigationItems}
        itemSelected={setSelectedItem}
      />
      {state.storyItems.hasOwnProperty(state.currentPage) && (
        <>
          <StoryList items={state.storyItems[state.currentPage]} />
          <nav>
            <p>Current Page: {state.currentPage}</p>
            <button
              disabled={1 === parseInt(state.currentPage, 10)}
              onClick={() => handlePageChange(state.currentPage - 1)}
            >
              Previous Page
            </button>
            <button
              disabled={
                state.currentPage + 1 > Object.keys(state.storyItems).length
              }
              onClick={() => handlePageChange(state.currentPage + 1)}
            >
              Next Page
            </button>
          </nav>
        </>
      )}
    </React.Fragment>
  );
}
