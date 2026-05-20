Feature: OrangeHRM Dashboard
  As an authenticated OrangeHRM user
  I want to view the dashboard
  So that I can get an overview of important HR information

  Background:
    Given I am logged in as "testadmin" with password "Admin@123#"
    And the application URL is "https://vibetestq-osondemand.orangehrm.com/"

  @smoke @dashboard
  Scenario: Dashboard loads successfully after login
    Then I should be on the Dashboard page
    And the dashboard header should display "Dashboard"
    And the navigation menu should be visible

  @dashboard
  Scenario: Dashboard displays quick launch widgets
    When I am on the Dashboard page
    Then I should see the Quick Launch section
    And it should contain shortcut icons for key modules

  @dashboard
  Scenario: Navigate to PIM module from sidebar
    When I click "PIM" in the navigation menu
    Then I should be on the PIM Employee List page
    And the page title should display "Employee Information"

  @dashboard
  Scenario: Navigate to Leave module from sidebar
    When I click "Leave" in the navigation menu
    Then I should be on the Leave module page

  @dashboard
  Scenario: Navigate to Recruitment module from sidebar
    When I click "Recruitment" in the navigation menu
    Then I should be on the Recruitment Vacancies page

  @dashboard
  Scenario: Navigate to Admin module from sidebar
    When I click "Admin" in the navigation menu
    Then I should be on the Admin User Management page

  @dashboard
  Scenario: User profile menu displays correct username
    When I click on the user profile avatar in the top bar
    Then a dropdown menu should appear
    And the menu should display the logged-in username

  @dashboard
  Scenario: Navigate to My Info from profile menu
    When I click on the user profile avatar in the top bar
    And I click "My Info" from the dropdown
    Then I should be on the My Info page

  @dashboard
  Scenario: Verify dashboard widgets are displayed
    When I am on the Dashboard page
    Then I should see the "Time at Work" widget
    And I should see the "My Actions" widget
    And I should see the "Quick Launch" widget

  @dashboard
  Scenario: Search functionality is available on dashboard
    When I am on the Dashboard page
    And I click on the search icon in the navigation
    And I type "PIM" in the search bar
    Then the search results should show relevant navigation links containing "PIM"

  @dashboard
  Scenario: Sidebar navigation collapses and expands
    When I am on the Dashboard page
    And I click the sidebar toggle button
    Then the sidebar should collapse
    When I click the sidebar toggle button again
    Then the sidebar should expand

  @dashboard
  Scenario: Admin can view pending leave approvals widget
    When I am on the Dashboard page
    Then I should see the "My Actions" widget
    And it should show pending leave requests count
