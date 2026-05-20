Feature: OrangeHRM PIM - Employee Management
  As an HR administrator
  I want to manage employee records
  So that I can maintain accurate personnel information

  Background:
    Given I am logged in as "testadmin" with password "Admin@123#"
    And the application URL is "https://vibetestq-osondemand.orangehrm.com/"
    And I navigate to the PIM module

  @smoke @pim
  Scenario: Add a new employee with required details
    When I click the "Add Employee" button
    And I enter the first name "John"
    And I enter the last name "Doe"
    And I click the Save button
    Then a new employee record should be created
    And I should see the employee profile page for "John Doe"

  @pim
  Scenario: Add a new employee with full details
    When I click the "Add Employee" button
    And I enter the first name "Jane"
    And I enter the middle name "Marie"
    And I enter the last name "Smith"
    And I enter the employee ID "EMP-1001"
    And I toggle the create login details option
    And I enter the login username "jane.smith"
    And I select the status "Enabled"
    And I enter the login password "Password@123"
    And I confirm the login password "Password@123"
    And I click the Save button
    Then a new employee record should be created
    And I should see the employee profile page for "Jane Smith"

  @pim
  Scenario: Search for an existing employee by name
    When I enter "John" in the employee name search field
    And I click the Search button
    Then the employee list should display results containing "John"

  @pim
  Scenario: Search for an employee by employee ID
    When I enter employee ID "EMP-0001" in the search field
    And I click the Search button
    Then the employee list should display the employee with ID "EMP-0001"

  @pim
  Scenario: Search returns no results for unknown employee
    When I enter "UnknownXYZ123" in the employee name search field
    And I click the Search button
    Then I should see the message "No Records Found"

  @pim
  Scenario: Edit employee personal details
    Given an employee named "John Doe" exists in the system
    When I open the employee profile for "John Doe"
    And I click the Personal Details tab
    And I update the nationality to "American"
    And I update the marital status to "Single"
    And I click the Save button
    Then I should see the success message "Successfully Saved"
    And the personal details should reflect the updated values

  @pim
  Scenario: Edit employee contact details
    Given an employee named "John Doe" exists in the system
    When I open the employee profile for "John Doe"
    And I click the Contact Details tab
    And I enter the street address "123 Main Street"
    And I enter the city "New York"
    And I enter the state "NY"
    And I enter the zip code "10001"
    And I select the country "United States"
    And I click the Save button
    Then I should see the success message "Successfully Saved"

  @pim
  Scenario: Upload a profile photo for an employee
    Given an employee named "John Doe" exists in the system
    When I open the employee profile for "John Doe"
    And I click on the profile photo area
    And I upload the image file "profile.jpg"
    And I click the Save button
    Then the profile photo should be updated successfully

  @pim
  Scenario: Delete an employee record
    Given an employee named "Temp Employee" exists in the system
    When I search for employee "Temp Employee"
    And I select the checkbox next to "Temp Employee"
    And I click the Delete Selected button
    And I confirm the deletion
    Then the employee "Temp Employee" should no longer appear in the list

  @pim
  Scenario: View employee list and verify pagination
    When I view the employee list
    Then I should see a list of employees
    And the list should show pagination controls

  @pim
  Scenario Outline: Add employee with various name combinations
    When I click the "Add Employee" button
    And I enter the first name "<firstName>"
    And I enter the last name "<lastName>"
    And I click the Save button
    Then a new employee record should be created for "<firstName> <lastName>"

    Examples:
      | firstName | lastName  |
      | Alice     | Johnson   |
      | Bob       | Williams  |
      | Carol     | Brown     |
