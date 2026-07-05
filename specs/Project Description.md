# Project Description
The vibe-coding test tesk: in a short amount of tiime I need to vibe-code a basic analytics site. It should work with differenc kinds of data common on business systems (mainly datasheets in excel or csv) and text reports. The main body is about frontend: nicely looking graffics, LLM-agent support to "talk to the data" and choose the correct graphs automaically. The most of code should be related to the frontend, simple Backend as a Service, or oversimplified backend options should be used for a setup. Aside from LLM API, the "free" and super basic systems should be used for services. The frontend should be in Russian language.

# Main features:

## Visualisation
Have a setup for most common graph types (bar plots, pie charts, time-series plots, scatterplots). Visualizations should be simplistic, but pretty: color palette of 4-6 basic colors, do not use busy elements, everything shuld be understandable from a single galnce.

## Talk to your data
Under the visualization elements there should be the field «Спроси что-нибудь про эти данные», questions in this field should be answered by an LLM agent. A field itself should be part of the interface. On the backend, an LLM agent should be setup: few options for different LLM API calls with prompts, query rewriting, data summary plugins, basic guardrails and thematic restrictions (talk only about the data).

## Data loader
Special data loader that should look like a box, where user can either type (or paste from buffer) something, or drag-and-drop files. It should accept files of different types: .csv (coma separator), .csv (";" is the separator, it's a common Russian or Cyrillic .csv version), .xls, .xlsx, .ods, .tsv for sheets; for text files .txt, .docx, .doc, .md, .log. All files should be preprocessed and checked for quality, size, and possible issues. And, all files should be preprocessed before they are handled to the LLM. Gracefull error handling is needed to report user any errors and suggest possible solutions to them. Each file should be checked for it's type, size, and correctness (that file is not corrupted).

## Data preprocessing for sheets.


## Data preprocessing for text files.
Based on 

## LLM data description
LLM agent needs to read the file or text, and make a simple classification (what type of data is it), and forward suggestions on what could be reported on this data. For seets, LLM should suggest a reasonable visualization options. Fjr sheets and for text - LLM should give a vrief summary of what it sees in the data, and what "insights" it is able to make from it.
