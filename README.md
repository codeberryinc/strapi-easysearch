# **EasySearch - Strapi Plugin**

A Strapi v5 plugin providing **transliterated fuzzy search**, **dynamic per-dataset pagination**, and **advanced filtering** for both **GraphQL** and **REST APIs**.

> **✅ Compatible with Strapi v5.10.3 and above**

![Strapi Version](https://img.shields.io/badge/Strapi-v5.10.3+-purple?style=flat-square)  
![License](https://img.shields.io/github/license/codeberryinc/strapi-tagger?style=flat-square) ![NPM Version](https://img.shields.io/npm/v/@codeberry/easysearch?style=flat-square)

---

## 🚀 Features

- **Flexible search approaches**: Choose between **pre-filtering**, **fuzzysort**, or a **hybrid** of both for the optimal balance of performance and accuracy.
- **Dynamic per-dataset pagination**: Each dataset (e.g., `article`, `offer`) has independent pagination metadata.
- **Transliterated fuzzy search**: Supports searches in multiple languages.
- **Subscription-based filtering**: Controls access to content based on user roles or subscription levels.
- **Advanced population handling**: Dynamically populates nested relations and media fields.
- **Search in JSON fields**: Extracts and indexes text from rich text blocks for comprehensive search.
- **Highly configurable** via Strapi config.
- **Supports both REST and GraphQL APIs**.

---

## ⚙️ Installation

```bash
npm install @codeberry/easysearch
```

or using yarn:

```bash
yarn add @codeberry/easysearch
```

---

## ⚙️ Configuration

Define your **search settings** inside `config/plugins.ts` or `config/plugins.js`:

```typescript
export default ({ env }) => ({
  'easy-search': {
    enabled: true,
    config: {
      contentTypes: [
        {
          uid: "api::article.article",
          transliterate: true,
          fuzzysortOptions: {
            characterLimit: 500,
            threshold: -100,
            limit: 10,
            keys: [
              { name: "title", weight: 0.1 },
              { name: "content", weight: 2 }, // Enables rich-text content search
            ],
          },
        },
        {
          uid: "api::offer.offer",
          transliterate: false,
          fuzzysortOptions: {
            characterLimit: 500,
            threshold: 0.5,
            limit: 10,
            keys: [
              { name: "title", weight: 0.2 },
              { name: "description", weight: -0.2 },
            ],
          },
        },
      ],
      searchApproach: "hybrid", // Options: "pre-filtering", "fuzzysort", "hybrid"
    },
  },
});
```

### Explanation:
- **`transliterate`**: Enables or disables transliteration for multilingual search.
- **`fuzzysortOptions.characterLimit`**: Trims searchable fields to improve performance.
- **`threshold`**: Defines how strict the matching is.
- **`limit`**: Controls the number of results returned.
- **`keys`**: Specifies which fields are indexed for search, along with their **weighting**.
- **`searchApproach`**:
  - **`pre-filtering`**: Uses database filtering for improved performance on large datasets.
  - **`fuzzysort`**: Fully relies on Fuzzysort for advanced matching and accuracy.
  - **`hybrid`**: Combines database filtering and Fuzzysort for balanced performance and relevancy.

---

## 🎯 Usage

### **REST API**

**Example request:**

```http
GET /api/easy-search/search?query=example&page=1&pageSize=10&populate=featuredMedia,image
```

#### **Supported Query Parameters**:
- **`query`**: The search term.
- **`fields`**: Comma-separated list of fields to return.
- **`populate`**: Dynamically populate nested relations.
- **`page`** & **`pageSize`**: Handles pagination.

---

### **GraphQL API**

**Example Query**:
```graphql
query EasySearch($query: String!, $page: Int, $pageSize: Int) {
  easySearch(query: $query, page: $page, pageSize: $pageSize) {
    article {
      documentId
      slug
      title
      excerpt
      featuredMedia {
        image {
          url
        }
      }
    }
    offer {
      documentId
      slug
      title
      description
      featuredMedia {
        image {
          url
        }
      }
    }
    pageInfo {
      article {
        page
        pageCount
        pageSize
        total
      }
      offer {
        page
        pageCount
        pageSize
        total
      }
    }
  }
}
```

---

## 🛠 Middleware (Optional)

EasySearch supports **custom middleware** for **filtering content dynamically**.  
For example, **restricting content access based on user roles or subscription levels**.

### **Example Middleware Registration**:
```typescript
// config/middlewares.ts
export default [
  // ... other middlewares
  "global::easy-search-filter"
];
```

---

## 📄 Changelog

### **Latest Updates**
- **Dynamic Search Approaches**: Introduced `searchApproach` (`pre-filtering`, `fuzzysort`, `hybrid`) for full control over search logic.
- **Per-Dataset Pagination**: Each dataset now has independent pagination metadata.
- **Enhanced JSON Field Support**: Rich text blocks are dynamically processed for comprehensive search.
- **Improved Flexibility**: Dynamic field handling with configurable `keys` per content type.
- **Transliteration Support**: Fully customizable on a per-content-type basis.

---

## ✅ TODO
- **Localization Support** → Improve multilingual search capabilities.
- **Unit Testing** → Add comprehensive tests for REST and GraphQL endpoints.
- **Optimize Search Indexing** → Enhance performance for larger datasets.

---

## 📝 Contributions

Contributions are welcome! If you find a bug or have an idea for improvement, feel free to **open an issue or submit a pull request**.

---

## 📜 License

This project is licensed under the **MIT License**.
