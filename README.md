# Mild

A small web framework apps with modest ambitions. One file. No dependencies. No build step.

Outline:

- The web is fun because it is dynamic
- Most pages would be better if they were mild in their use of JS
- Mild is for web pages that need just a bit of interactivity.
- You can use it to build a small SPAs or components for an island architecture.
- Ordinary Web Components.
- Inspired by the Elm App Architecture.

## Installing

```html
<script type="module" src="mild.js">
```

## Views

Views render their state directly.

You might think of a view as similar to a virtual DOM patch operation, but you're hand-authoring the patching logic in write. Instead of diffing every element in the tree, your write function targets exactly the elements that need to change. This makes views extremely efficient.

## Components and stores

## Effects

## Lists

## Complex components