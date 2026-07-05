# Visualization Options

This MVP supports a small set of common visualization types selected from the shape of the user's data.

| Plot type | Data signatures | Examples |
| --- | --- | --- |
| Bar chart | One categorical column and one numeric column. The categorical column contains repeated groups, labels, names, or statuses. The numeric column contains counts, sums, averages, scores, or other measured values. | Sales by product category; number of users by country; average rating by support agent. |
| Line chart | One date/time column and one numeric column. Rows represent ordered observations over time, such as daily, weekly, monthly, or timestamped values. | Daily revenue over a month; weekly signups; hourly website traffic. |
| Scatter plot | Two numeric columns where each row represents one observation with an x value and a y value. Best when the goal is to show relationship, correlation, clusters, or outliers. | Product price vs. rating; apartment size vs. rent; ad spend vs. conversions. |
| Histogram | One numeric column with many individual values. Best when the goal is to show distribution, frequency, spread, or skew. | Distribution of order amounts; user ages; response times. |
| Pie or donut chart | One categorical column and one numeric column where values represent parts of a whole. Best with a small number of categories, usually 2-6. | Market share by browser; expenses by category; leads by source. |
| Heatmap | Two categorical/time-bucket columns and one numeric column. Data can be arranged as a grid where color intensity represents the numeric value. | Sales by weekday and hour; error count by service and severity; attendance by class and month. |

## Suggested Selection Order

1. If there is a date/time column and a numeric column, use a line chart.
2. If there are two numeric columns, use a scatter plot.
3. If there is one numeric column and no useful category, use a histogram.
4. If there is one categorical column and one numeric column, use a bar chart.
5. If categorical values are few and numeric values appear to be parts of a whole, use a pie or donut chart.
6. If there are two categorical or time-bucket dimensions and one numeric value, use a heatmap.
