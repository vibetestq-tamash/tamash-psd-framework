Feature: OrangeHRM Admin - User Management
  As a system administrator
  I want to manage system users and configurations
  So that I can control access and system settings

  Background:
    Given I am logged in as "testadmin" with password "Admin@123#"
    And the application URL is "https://vibetestq-osondemand.orangehrm.com/"
    And I navigate to the Admin module

  @smoke @admin
  Scenario: Add a new system user
    When I click "User Management" from the Admin menu
    And I click "Users" from the submenu
    And I click the "Add" button
    And I select the user role "Admin"
    And I search and select the employee name "John Doe"
    And I select the status "Enabled"
    And I enter the username "john.doe.admin"
    And I enter the password "Admin@12345"
    And I confirm the password "Admin@12345"
    And I click the Save button
    Then the user "john.doe.admin" should be created successfully
    And it should appear in the users list

  @admin
  Scenario: Search for a system user by username
    When I click "User Management" from the Admin menu
    And I click "Users" from the submenu
    And I enter username "Admin" in the search field
    And I click the Search button
    Then the users list should display results containing "Admin"

  @admin
  Scenario: Search for a user by role
    When I click "User Management" from the Admin menu
    And I click "Users" from the submenu
    And I select the user role filter "Admin"
    And I click the Search button
    Then all displayed users should have the role "Admin"

  @admin
  Scenario: Edit an existing system user
    Given a system user "john.doe.admin" exists
    When I click the edit icon for user "john.doe.admin"
    And I change the status to "Disabled"
    And I click the Save button
    Then I should see the success message "Successfully Saved"
    And the user "john.doe.admin" should have status "Disabled"

  @admin
  Scenario: Delete a system user
    Given a system user "temp.user" exists
    When I select the checkbox next to "temp.user"
    And I click the Delete button
    And I confirm the deletion
    Then "temp.user" should no longer appear in the users list

  @admin
  Scenario: Add a new job title
    When I click "Job" from the Admin menu
    And I click "Job Titles" from the submenu
    And I click the "Add" button
    And I enter the job title "QA Engineer"
    And I enter the job description "Responsible for quality assurance"
    And I click the Save button
    Then the job title "QA Engineer" should be created successfully

  @admin
  Scenario: Add a new pay grade
    When I click "Job" from the Admin menu
    And I click "Pay Grades" from the submenu
    And I click the "Add" button
    And I enter the pay grade name "Grade A"
    And I click the Save button
    Then the pay grade "Grade A" should be created successfully

  @admin
  Scenario: Add a new employment status
    When I click "Job" from the Admin menu
    And I click "Employment Status" from the submenu
    And I click the "Add" button
    And I enter the employment status "Contract"
    And I click the Save button
    Then the employment status "Contract" should be created successfully

  @admin
  Scenario: Add a new location
    When I click "Organization" from the Admin menu
    And I click "Locations" from the submenu
    And I click the "Add" button
    And I enter the location name "New York Office"
    And I select the country "United States"
    And I enter the state "New York"
    And I enter the city "New York"
    And I click the Save button
    Then the location "New York Office" should be created successfully

  @admin
  Scenario: View organization general information
    When I click "Organization" from the Admin menu
    And I click "General Information" from the submenu
    Then I should see the organization general information page
    And it should display the organization name and details

  @admin
  Scenario: Add a new nationality
    When I click "Qualifications" from the Admin menu
    And I click "Nationalities" from the submenu
    And I click the "Add" button
    And I enter the nationality name "Martian"
    And I click the Save button
    Then the nationality "Martian" should be created successfully

  @admin
  Scenario Outline: Manage user roles with different configurations
    When I click "User Management" from the Admin menu
    And I click "Users" from the submenu
    And I add a new user with role "<role>" for employee "<employee>"
    Then the new user should be created with role "<role>"

    Examples:
      | role  | employee    |
      | Admin | Alice Brown |
      | ESS   | Bob Wilson  |
