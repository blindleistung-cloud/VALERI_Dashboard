# VALERI Dashboard

**Valuation of Energy Related Investments (VALERI)**

The VALERI Dashboard is a web-based tool designed to calculate the economic valuation of energy-related investments based on the **DIN EN 17463** standard. It provides a comprehensive analysis of Net Present Value (NPV), Payback Periods, and Weighted Average Cost of Capital (WACC) across multiple scenarios.

## Features

- **Scenario Analysis**: Compare **Likely**, **Worst Case**, and **Best Case** scenarios side-by-side.
- **WACC Calculation**: Built-in calculator for Weighted Average Cost of Capital (WACC) using Cost of Equity ($r_{eq}$) and Cost of Debt ($r_{debt}$).
- **Dynamic Cash Flow**: detailed annual cash flow projections including energy price increases ($i_{energy}$) and service price adjustments.
- **Interactive UI**: Modern, glassmorphism-inspired design with real-time updates and responsive grids.
- **Standards Compliance**: Aligned with the methodology of DIN EN 17463.

## Usage

1.  **Open the Application**: Open `index.html` in any modern web browser.
2.  **Define Capital Structure**:
    *   Enter the **Equity Ratio** (Debt Ratio is calculated automatically).
    *   Input the Cost of Equity and Cost of Debt for all three scenarios (Likely/Worst/Best).
    *   View the calculated WACC for each scenario.
3.  **Input Project Parameters**:
    *   Enter details for Investment ($I_0$), Energy Savings ($E_{save}$), Price ($P_0$), Price Increase ($i_{energy}$), and Lifetime ($T$).
    *   Values can be customized for each scenario.
4.  **Analyze Results**:
    *   Review the **Scenario Comparison Table** for NPV and Payback Period.
    *   Check the detailed year-by-year cash flow table for the Likely Case.

## Technologies

- **HTML5**: Semantic structure.
- **CSS3**: Modern styling with CSS Grid, Flexbox, and Variables.
- **JavaScript (ES6+)**: Calculation logic and DOM manipulation.

## License

[MIT License](LICENSE)
